import { PDFDocument, PDFArray, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

/**
 * Turns a quotation that was already filled in by this app back into its pristine template.
 *
 * Older versions saved the filled PDF over the template, so the next fill ran on top of the previous
 * one (hidden old text, repeated tables). Everything pdf-lib draws is appended to a page as extra content
 * streams after a `q … Q` wrapper around the original content, so the original can be recovered exactly:
 *
 *   [ "q", ...original streams, "Q", overlay ]   ->   [ ...original streams ]
 *
 * Continuation pages that a previous fill inserted for overflowing table rows are removed as well.
 */

export const CONTINUATION_KEY = 'DocAIContinuation';
// "(CONTD.)" as written by drawText with a standard font (hex-encoded WinAnsi), used by older fills
const LEGACY_CONTINUATION_HEX = '28434F4E54442E29';

const decode = (stream) => {
  try {
    return String.fromCharCode(...decodePDFRawStream(stream).decode());
  } catch {
    return null;
  }
};

const isOperatorOnly = (doc, ref, op) => {
  const stream = doc.context.lookup(ref);
  if (!(stream instanceof PDFRawStream) || stream.contents.length > 48) return false;
  return (decode(stream) || '').trim() === op;
};

const mentionsContinuation = (doc, ref) => {
  const stream = doc.context.lookup(ref);
  if (!(stream instanceof PDFRawStream) || stream.contents.length > 200000) return false;
  let text = '';
  try {
    const bytes = decodePDFRawStream(stream).decode();
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  } catch {
    return false;
  }
  return text.toUpperCase().includes(LEGACY_CONTINUATION_HEX);
};

/** @returns {Promise<{ bytes: Uint8Array, changed: boolean }>} */
export async function restoreTemplate(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  let changed = false;
  const dropPages = [];

  doc.getPages().forEach((page, index) => {
    if (page.node.get(PDFName.of(CONTINUATION_KEY))) { dropPages.push(index); return; }
    const contents = page.node.Contents();
    if (!(contents instanceof PDFArray)) return;

    let refs = contents.asArray();
    let peeled = false;
    let continuation = false;
    // one `q … Q` wrapper + trailing overlays per earlier fill
    while (refs.length >= 3 && isOperatorOnly(doc, refs[0], 'q')) {
      let close = -1;
      for (let i = refs.length - 1; i > 0; i--) if (isOperatorOnly(doc, refs[i], 'Q')) { close = i; break; }
      if (close < 0) break;
      if (refs.slice(close + 1).some((ref) => mentionsContinuation(doc, ref))) continuation = true;
      refs = refs.slice(1, close);
      peeled = true;
    }
    if (continuation) { dropPages.push(index); return; }
    if (peeled) {
      page.node.set(PDFName.of('Contents'), doc.context.obj(refs));
      changed = true;
    }
  });

  if (!changed && !dropPages.length) return { bytes: pdfBytes, changed: false };

  // Re-pack the kept pages into a fresh document: only what they still use is copied, which leaves the old
  // overlays, their fonts and the generated continuation pages behind.
  const keep = doc.getPageIndices().filter((index) => !dropPages.includes(index));
  const clean = await PDFDocument.create();
  (await clean.copyPages(doc, keep)).forEach((page) => clean.addPage(page));
  changed = true;
  return { bytes: await clean.save(), changed };
}

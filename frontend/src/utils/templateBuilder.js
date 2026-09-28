import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Turns the widgets placed on the Template Editor canvas into a real PDF file.
 *
 * The output follows the same conventions `quotationEngine.js` looks for when it later
 * fills a quotation from this template: a "Date :" / "To :" label pair (left blank, so
 * fillQuotation's label-based fill picks them up) and a position-requirements table with
 * a recognisable header row and ruled grid lines.
 */

export const CANVAS_WIDTH_PX = 794; // A4 at 96 PPI, matches EditorView / TemplateEditorView canvas
export const CANVAS_HEIGHT_PX = 1123;
const PT_PER_PX = 0.75; // 72pt / 96px

export const TABLE_HEADERS = ['S.No', 'Role', 'No of Positions', 'Qualifications', 'Package'];

const FONT_SETS = {
  Helvetica: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, italic: StandardFonts.HelveticaOblique, boldItalic: StandardFonts.HelveticaBoldOblique },
  Inter: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, italic: StandardFonts.HelveticaOblique, boldItalic: StandardFonts.HelveticaBoldOblique },
  Montserrat: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, italic: StandardFonts.HelveticaOblique, boldItalic: StandardFonts.HelveticaBoldOblique },
  Arial: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, italic: StandardFonts.HelveticaOblique, boldItalic: StandardFonts.HelveticaBoldOblique },
  'Times New Roman': { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold, italic: StandardFonts.TimesRomanItalic, boldItalic: StandardFonts.TimesRomanBoldItalic },
};

const hexToRgbTuple = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0.07, 0.09, 0.15];
};

const wrapText = (text, font, size, maxW) => {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const push = () => { if (cur) lines.push(cur); cur = ''; };
  words.forEach((w) => {
    let word = w;
    while (font.widthOfTextAtSize(word, size) > maxW && word.length > 1) {
      let n = word.length - 1;
      while (n > 1 && font.widthOfTextAtSize(word.slice(0, n), size) > maxW) n--;
      push();
      lines.push(word.slice(0, n));
      word = word.slice(n);
    }
    const trial = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxW) cur = trial;
    else { push(); cur = word; }
  });
  push();
  return lines.length ? lines : [''];
};

const pickFont = (fonts, bold, italic) => (bold && italic ? fonts.boldItalic : bold ? fonts.bold : italic ? fonts.italic : fonts.regular);

const drawTable = (page, box, el, fonts) => {
  const { x, yTop, width, height } = box;
  const rows = Math.max(1, Math.min(20, el.rows || 3));
  const headerH = 26;
  const rowH = Math.max(20, (height - headerH) / rows);
  const cols = [0, 0.08, 0.32, 0.56, 0.78, 1].map((r) => x + r * width);
  const lw = 1;
  const black = rgb(0, 0, 0);

  const top = yTop;
  const headerBottom = top - headerH;
  const bottom = headerBottom - rowH * rows;

  page.drawLine({ start: { x, y: top }, end: { x: x + width, y: top }, thickness: lw, color: black });
  page.drawLine({ start: { x, y: headerBottom }, end: { x: x + width, y: headerBottom }, thickness: lw, color: black });
  for (let r = 1; r < rows; r++) {
    const y = headerBottom - rowH * r;
    page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: lw, color: black });
  }
  page.drawLine({ start: { x, y: bottom }, end: { x: x + width, y: bottom }, thickness: lw, color: black });
  cols.forEach((cx) => page.drawLine({ start: { x: cx, y: top }, end: { x: cx, y: bottom }, thickness: lw, color: black }));

  TABLE_HEADERS.forEach((label, i) => {
    const cw = cols[i + 1] - cols[i];
    const w = fonts.bold.widthOfTextAtSize(label, 10);
    page.drawText(label, { x: cols[i] + (cw - w) / 2, y: top - headerH / 2 - 3.5, size: 10, font: fonts.bold, color: black });
  });

  // Anchors the table's lower edge for the fill engine when it re-analyses this PDF later.
  page.drawText('Note: Replacement guarantee and service fee as agreed in the quotation.', {
    x, y: bottom - 16, size: 8, font: fonts.regular, color: rgb(0.4, 0.4, 0.4),
  });
};

export async function buildTemplatePdf(elements, opts = {}) {
  const widthPx = opts.widthPx || CANVAS_WIDTH_PX;
  const heightPx = opts.heightPx || CANVAS_HEIGHT_PX;
  const pageWpt = widthPx * PT_PER_PX;
  const pageHpt = heightPx * PT_PER_PX;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageWpt, pageHpt]);

  const fontCache = new Map();
  const getFonts = async (family) => {
    const key = FONT_SETS[family] ? family : 'Helvetica';
    if (!fontCache.has(key)) {
      const set = FONT_SETS[key];
      fontCache.set(key, {
        regular: await pdfDoc.embedFont(set.regular),
        bold: await pdfDoc.embedFont(set.bold),
        italic: await pdfDoc.embedFont(set.italic),
        boldItalic: await pdfDoc.embedFont(set.boldItalic),
      });
    }
    return fontCache.get(key);
  };

  const toPt = (px) => px * PT_PER_PX;

  for (const el of elements) {
    const x = toPt(el.x);
    const wPt = toPt(el.width);
    const hPt = toPt(el.height);
    const yTop = pageHpt - toPt(el.y);
    const yBottom = yTop - hPt;

    if (el.type === 'banner') {
      page.drawRectangle({ x, y: yBottom, width: wPt, height: hPt, color: rgb(...hexToRgbTuple(el.bgColor || '#13B6D7')) });
      continue;
    }
    if (el.type === 'divider') {
      page.drawLine({ start: { x, y: yTop }, end: { x: x + wPt, y: yTop }, thickness: Math.max(0.75, hPt), color: rgb(...hexToRgbTuple(el.color || '#111827')) });
      continue;
    }
    if (el.type === 'image') {
      if (!el.src) continue;
      try {
        const isPng = /image\/png/i.test(el.src);
        const base64 = el.src.split(',')[1] || el.src;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        page.drawImage(img, { x, y: yBottom, width: wPt, height: hPt });
      } catch (err) {
        console.error('Failed to embed image widget:', err);
      }
      continue;
    }
    if (el.type === 'table') {
      const fonts = await getFonts(el.fontFamily);
      drawTable(page, { x, yTop, width: wPt, height: hPt }, el, fonts);
      continue;
    }

    // Text-like widgets: heading, text, dateField, companyField.
    const fonts = await getFonts(el.fontFamily);
    const font = pickFont(fonts, el.bold, el.italic);
    const size = el.fontSize || 14;
    const color = hexToRgbTuple(el.color || '#111827');
    // dateField / companyField are left as bare labels: fillQuotation fills the value in after the label.
    const text = el.type === 'dateField' ? 'Date :' : el.type === 'companyField' ? 'To :' : (el.text || '');
    if (!text) continue;
    const lines = wrapText(text, font, size, wPt);
    const lineH = size * 1.3;
    lines.forEach((ln, i) => {
      const lw = font.widthOfTextAtSize(ln, size);
      let lx = x;
      if (el.align === 'center') lx = x + (wPt - lw) / 2;
      else if (el.align === 'right') lx = x + Math.max(0, wPt - lw);
      const ly = yTop - size * 1.0 - i * lineH;
      page.drawText(ln, { x: lx, y: ly, size, font, color: rgb(...color) });
      if (el.underline) {
        page.drawLine({ start: { x: lx, y: ly - size * 0.12 }, end: { x: lx + lw, y: ly - size * 0.12 }, thickness: Math.max(0.5, size * 0.05), color: rgb(...color) });
      }
    });
  }

  return pdfDoc.save();
}

export const uint8ArrayToBase64 = (bytes) => {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
};

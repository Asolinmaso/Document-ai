import { PDFDocument, PDFName, PDFBool, rgb } from 'pdf-lib';
import { createFontBook, describeFontName, makeSafeText } from './pdfFonts';
import { applyEdits, buildStream, findEdits, fontSizeOf, listBlocks, segmentLines } from './textReflow';
import { CONTINUATION_KEY } from './templateRestore';

/**
 * Quotation fill engine.
 *
 * Always run on the pristine template (see templateRestore.js), never on an already filled PDF.
 * Works with blank templates that carry placeholders (XXXX, xx%, [Company Name] ...), with templates
 * that carry a sample client's values, and with Date / To lines that are blank (label only).
 *
 * Everything is anchored on what is really in the PDF (labels, sentences, and the table grid measured
 * from a raster of the page) rather than on fixed coordinates. Text is replaced by re-typesetting its
 * line in the template's own font (textReflow.js), so values never shrink, overlap or leave holes.
 * All coordinates below are PDF points with the origin at the bottom-left.
 */

// Header banner (cyan) starts above this fraction of the page height; footer band ends below FOOTER_RATIO.
const BANNER_RATIO = 0.845;
const FOOTER_RATIO = 0.095;
const FOOTER_CLEAR_RATIO = 0.075; // continuation pages are wiped down to here (the footer band sits just below)
const BANNER_RGB = { r: 0x13 / 255, g: 0xb6 / 255, b: 0xd7 / 255 };
const RIGHT_MARGIN = 26;
const HEADER_RIGHT_MARGIN = 10; // the banner runs to the page edge
const MAX_ROWS = 200;
const RASTER_SCALE = 2;
export const DEFAULT_TEXT_COLOR = '#111827';

const TABLE_KEYS = ['s.no', 'role', 'positions', 'qualifications', 'package'];
const TABLE_HEADERS = ['S.No', 'Role', 'No of Positions', 'Qualifications', 'Package'];
// Pages whose body text can receive a value: only these are rasterised to read the text colours.
const BODY_TRIGGER = /x{2,}|\[[^\]]*\]|\{\{|service\s+fee|guarantee|services\s+to|sharp\s+associates|continued\s+success/i;
const CONTINUATION_HEADING = /position\s+requirements\s*\(contd/i;

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 } : { r: 0.07, g: 0.09, b: 0.15 };
};

/* ────────────────────────────────────────────────────────────────────────────
 * Analysis (runs once per template)
 * ────────────────────────────────────────────────────────────────────────── */

const defaultRasterize = async (page, scale) => {
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

export const groupIntoLines = (items, pageNum) => {
  const lines = [];
  items.forEach((item) => {
    const y = Math.round(item.transform[5]);
    const line = lines.find((l) => Math.abs(l.y - y) < 5);
    if (line) line.items.push(item);
    else lines.push({ y, page: pageNum, items: [item] });
  });
  lines.forEach((l) => {
    l.items.sort((a, b) => a.transform[4] - b.transform[4]);
    l.str = l.items.map((i) => i.str).join(' ');
    l.minX = Math.min(...l.items.map((i) => i.transform[4]));
    l.maxX = Math.max(...l.items.map((i) => i.transform[4] + i.width));
    l.height = Math.max(...l.items.map((i) => fontSizeOf(i)));
  });
  return lines.sort((a, b) => b.y - a.y);
};


/**
 * Finds the position-requirements table grid on a rasterised page.
 * Returns { cols[], top, headerBottom, bottom, seps[], lw } in PDF points or null.
 */
const detectGrid = (img, scale, pageH, origin, headerY, floorY) => {
  const { data, width, height } = img;
  const isDark = (x, y) => {
    const i = (y * width + x) * 4;
    return data[i + 3] > 128 && data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < 150;
  };
  // the raster starts at the page's view box; text and drawing coordinates live in PDF user space
  const toPx = (yPt) => Math.max(0, Math.min(height - 1, Math.round((origin.y + pageH - yPt) * scale)));
  const toPt = (yPx) => origin.y + pageH - yPx / scale;

  const y0 = toPx(headerY + 60);
  const y1 = toPx(floorY);
  const hRows = [];
  for (let y = y0; y <= y1; y++) {
    let run = 0, best = 0, bestEnd = 0;
    for (let x = 0; x < width; x++) {
      if (isDark(x, y)) { run++; if (run > best) { best = run; bestEnd = x; } } else run = 0;
    }
    if (best >= width * 0.45) hRows.push({ y, xL: bestEnd - best + 1, xR: bestEnd });
  }
  if (hRows.length < 2) return null;

  const groups = [];
  hRows.forEach((r) => {
    const g = groups[groups.length - 1];
    if (g && r.y - g.y1 <= 1) { g.y1 = r.y; g.xL = Math.min(g.xL, r.xL); g.xR = Math.max(g.xR, r.xR); }
    else groups.push({ y0: r.y, y1: r.y, xL: r.xL, xR: r.xR });
  });
  // keep only the lines that share the table's x-extent (the widest one)
  const widest = groups.reduce((a, b) => (b.xR - b.xL > a.xR - a.xL ? b : a));
  // Thickness from ink coverage (anti-aliased rows count for what they cover), sampled away from the column rules
  const lumAt = (x, y) => { const i = (y * width + x) * 4; return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114; };
  const thicknessOf = (g) => {
    const xs = [0.13, 0.31, 0.47, 0.69, 0.87].map((r) => Math.round(g.xL + (g.xR - g.xL) * r));
    const perColumn = xs.map((x) => {
      let ink = 0;
      for (let y = Math.max(0, g.y0 - 1); y <= Math.min(height - 1, g.y1 + 1); y++) ink += 1 - lumAt(x, y) / 255;
      return ink;
    }).sort((a, b) => a - b);
    return perColumn[Math.floor(perColumn.length / 2)] / scale;
  };
  const hLines = groups
    .filter((g) => Math.abs(g.xL - widest.xL) < 6 && Math.abs(g.xR - widest.xR) < 6)
    .map((g) => ({ y: toPt((g.y0 + g.y1 + 1) / 2), th: thicknessOf(g) }))
    .sort((a, b) => b.y - a.y);

  const above = hLines.filter((l) => l.y > headerY);
  const below = hLines.filter((l) => l.y < headerY);
  if (!above.length || below.length < 2) return null;
  const top = above[above.length - 1];
  const headerBottom = below[0];
  const bottom = below[below.length - 1];
  const seps = below.slice(1, -1);

  const vy0 = toPx(top.y);
  const vy1 = toPx(bottom.y);
  const need = (vy1 - vy0) * 0.9;
  const vXs = [];
  for (let x = Math.max(0, widest.xL - 3); x <= Math.min(width - 1, widest.xR + 3); x++) {
    let run = 0, best = 0;
    for (let y = vy0; y <= vy1; y++) {
      if (isDark(x, y)) { run++; if (run > best) best = run; } else run = 0;
    }
    if (best >= need) vXs.push(x);
  }
  const vGroups = [];
  vXs.forEach((x) => {
    const g = vGroups[vGroups.length - 1];
    if (g && x - g.x1 <= 1) g.x1 = x; else vGroups.push({ x0: x, x1: x });
  });
  if (vGroups.length < 3) return null;

  return {
    cols: vGroups.map((g) => origin.x + (g.x0 + g.x1 + 1) / 2 / scale),
    top: top.y,
    headerBottom: headerBottom.y,
    bottom: bottom.y,
    seps: seps.map((s) => s.y),
    lw: Math.max(0.5, Math.min(1.6, headerBottom.th)),
  };
};

/** Grid guessed from the header text only – used when no ruling lines could be measured. */
const guessGrid = (headerLine, noteLine, pageW) => {
  const items = headerLine.items;
  let cols;
  if (items.length === TABLE_HEADERS.length) {
    cols = [items[0].transform[4] - 10];
    for (let i = 0; i < items.length - 1; i++) cols.push((items[i].transform[4] + items[i].width + items[i + 1].transform[4]) / 2);
    cols.push(items[items.length - 1].transform[4] + items[items.length - 1].width + 14);
  } else {
    const l = Math.max(20, headerLine.minX - 10);
    const w = pageW - RIGHT_MARGIN - l;
    cols = [0, 0.1, 0.38, 0.58, 0.8, 1].map((r) => l + r * w);
  }
  const headerBottom = headerLine.y - 22;
  const bottom = noteLine ? noteLine.y + noteLine.height + 8 : headerBottom - 160;
  return { cols, top: headerLine.y + 24, headerBottom, bottom, seps: [], lw: 0.8, guessed: true };
};


/** Colour of a text item: the darkest pixel inside its x-height band (the background is always lighter). */
const sampleInk = (img, scale, pageH, origin, item) => {
  const size = fontSizeOf(item);
  const x0 = Math.max(0, Math.floor((item.transform[4] - origin.x) * scale));
  const x1 = Math.min(img.width - 1, Math.ceil((item.transform[4] + item.width - origin.x) * scale));
  const y0 = Math.max(0, Math.floor((origin.y + pageH - (item.transform[5] + size * 0.72)) * scale));
  const y1 = Math.min(img.height - 1, Math.ceil((origin.y + pageH - (item.transform[5] + size * 0.02)) * scale));
  let best = null;
  let bestLum = Infinity;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3] < 200) continue;
      const lum = img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
      if (lum < bestLum) { bestLum = lum; best = i; }
    }
  }
  return best === null ? null : { r: img.data[best] / 255, g: img.data[best + 1] / 255, b: img.data[best + 2] / 255 };
};

/**
 * What is behind a strip of the page (e.g. white, then the pale watermark, then white again), as runs
 * [{ x0, x1, color }] in points. Per pixel column the lightest pixel of the strip is taken, which is the
 * background wherever text or a rule crosses it. Lets erased areas be repainted without cutting the watermark.
 */
const backgroundRuns = (img, scale, pageH, origin, x0Pt, x1Pt, yTopPt, yBottomPt) => {
  const x0 = Math.max(0, Math.floor((x0Pt - origin.x) * scale));
  const x1 = Math.min(img.width - 1, Math.ceil((x1Pt - origin.x) * scale));
  const y0 = Math.max(0, Math.floor((origin.y + pageH - yTopPt) * scale));
  const y1 = Math.min(img.height - 1, Math.ceil((origin.y + pageH - yBottomPt) * scale));
  const runs = [];
  for (let x = x0; x <= x1; x++) {
    let best = -1;
    let at = -1;
    for (let y = y0; y <= y1; y++) {
      const i = (y * img.width + x) * 4;
      const lum = img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
      if (lum > best) { best = lum; at = i; }
    }
    // a column that is dark all the way down is a rule, not background
    const c = at < 0 || best < 150 ? [255, 255, 255] : [img.data[at], img.data[at + 1], img.data[at + 2]];
    const key = `${c[0] >> 3},${c[1] >> 3},${c[2] >> 3}`;
    const last = runs[runs.length - 1];
    const xPt = origin.x + x / scale;
    if (last && last.key === key) last.x1 = xPt + 1 / scale;
    else runs.push({ key, x0: xPt, x1: xPt + 1 / scale, color: { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 } });
  }
  if (!runs.length || runs.length > 48) return null; // too busy to follow: the caller paints plain white
  if (runs.length === 1 && runs[0].key === '31,31,31') return null;
  runs[0].x0 = x0Pt;
  runs[runs.length - 1].x1 = x1Pt;
  return runs.map(({ x0: a, x1: b, color }) => ({ x0: a, x1: b, color }));
};

/**
 * @param options.allColours  read text colours / backgrounds on every page (template editing), not only on
 *                            the pages that can receive a value
 */
export async function analyzeTemplate(pdfjsLib, pdfBytes, { rasterize = defaultRasterize, allColours = false } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const pdfLines = [];
  const tables = [];
  const pageSizes = [];
  const extracted = { date: null, company: null };
  let bannerRgb = null;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const origin = { x: page.view[0], y: page.view[1] };
    pageSizes.push({ width: vp.width, height: vp.height, ...origin });
    const tc = await page.getTextContent();

    // real font names ("Montserrat-Bold") are only known once the page's operator list has been built
    try { await page.getOperatorList(); } catch { /* fonts then count as unknown */ }
    const fontInfo = new Map();
    const infoOf = (fontName) => {
      if (!fontInfo.has(fontName)) {
        let name = '';
        try { name = page.commonObjs.get(fontName)?.name || ''; } catch { /* not resolved */ }
        fontInfo.set(fontName, describeFontName(name));
      }
      return fontInfo.get(fontName);
    };

    const items = tc.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ str: i.str, transform: i.transform, width: i.width, height: i.height, fontName: i.fontName, pageNum: p, ...infoOf(i.fontName) }));
    const lines = groupIntoLines(items, p);
    pdfLines.push(...lines);
    const pageText = lines.map((l) => l.str).join('\n');

    lines.filter((l) => l.y > origin.y + vp.height * BANNER_RATIO).forEach((l) => {
      const d = /date\s*:\s*(.+)$/i.exec(l.str);
      const t = /\bto\s*:\s*(.+)$/i.exec(l.str);
      if (d && !extracted.date && !/x{3,}/i.test(d[1])) extracted.date = d[1].trim();
      if (t && !extracted.company && !/x{3,}/i.test(t[1])) extracted.company = t[1].trim();
    });

    let raster = null;
    const getRaster = async () => (raster ||= await rasterize(page, RASTER_SCALE));

    if (!bannerRgb) {
      const hdr = lines.find((l) => l.y > origin.y + vp.height * BANNER_RATIO && /^\s*(date|to)\s*:/i.test(l.items[0].str));
      if (hdr) {
        try {
          // sample a blank pixel of the banner just right of the header text so erased patches match exactly
          const img = await getRaster();
          const px = Math.round((hdr.maxX + 12 - origin.x) * RASTER_SCALE);
          const py = Math.round((origin.y + vp.height - (hdr.y + hdr.height * 0.35)) * RASTER_SCALE);
          if (px > 0 && px < img.width - 2 && py > 0 && py < img.height) {
            const i = (py * img.width + px) * 4;
            if (img.data[i + 3] > 200) bannerRgb = { r: img.data[i] / 255, g: img.data[i + 1] / 255, b: img.data[i + 2] / 255 };
          }
        } catch { /* keep the default banner colour */ }
      }
    }

    if (allColours || BODY_TRIGGER.test(pageText)) {
      try {
        const img = await getRaster();
        items.forEach((item) => {
          const size = fontSizeOf(item);
          item.color = sampleInk(img, RASTER_SCALE, vp.height, origin, item) || undefined;
          // same strip textReflow erases when it re-typesets the line
          item.bg = backgroundRuns(img, RASTER_SCALE, vp.height, origin, item.transform[4] - 0.75, item.transform[4] + item.width + 0.75, item.transform[5] + size * 0.94, item.transform[5] - size * 0.28) || undefined;
        });
      } catch (err) {
        console.warn('Text colours could not be read, values will use the default colour:', err);
      }
    }

    if (CONTINUATION_HEADING.test(pageText)) continue; // a page an earlier fill added, never a template table
    const headerLine = lines.find((l) => TABLE_KEYS.filter((k) => l.str.toLowerCase().includes(k)).length >= 3);
    if (!headerLine) continue;
    const noteLine = lines.find((l) => l.y < headerLine.y && /^note\s*:/i.test(l.str.trim()));
    let grid = null;
    try {
      const img = await getRaster();
      const floor = noteLine ? noteLine.y + 2 : headerLine.y - 520;
      grid = detectGrid(img, RASTER_SCALE, vp.height, origin, headerLine.y, floor);
      if (grid && grid.cols.length !== TABLE_HEADERS.length + 1) grid = null; // unexpected column count -> don't trust it
      if (grid) {
        // background just above each of the template's row dividers, for wiping them (see applyTable)
        const l = grid.cols[0];
        const r = grid.cols[grid.cols.length - 1];
        grid.sepFills = grid.seps.map((sy) => backgroundRuns(img, RASTER_SCALE, vp.height, origin, l - grid.lw, r + grid.lw, sy + grid.lw + 4.5, sy + grid.lw + 2.2));
      }
    } catch (err) {
      console.warn('Table grid detection failed, using text-based estimate:', err);
    }
    const headItem = headerLine.items[0];
    tables.push({
      page: p,
      headerY: headerLine.y,
      noteLine: noteLine || null,
      family: headItem.family,
      headerSize: fontSizeOf(headItem),
      ...(grid || guessGrid(headerLine, noteLine, vp.width)),
    });
  }

  return { pdfLines, tables, pageSizes, extracted, bannerRgb };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Filling
 * ────────────────────────────────────────────────────────────────────────── */

const wrapText = (text, font, size, maxW) => {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const push = () => { if (cur) lines.push(cur); cur = ''; };
  words.forEach((w) => {
    let word = w;
    while (font.widthOfTextAtSize(word, size) > maxW && word.length > 1) {
      // break over-long words by characters
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

/** Cuts `text` with "..." so it fits `maxW` at the given size. */
const ellipsize = (text, font, size, maxW) => {
  const t = String(text ?? '');
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  const dots = '...';
  let n = t.length;
  while (n > 1 && font.widthOfTextAtSize(t.slice(0, n).trimEnd() + dots, size) > maxW) n--;
  return t.slice(0, n).trimEnd() + dots;
};

const escapeRe = (s) => s.trim().replace(/\s+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+').replace(/['’]/g, "['’]");

/** "45000" -> "Rs. 45,000"; text that already names a currency or a percentage is kept as typed. */
const formatAdvance = (advanceAmount) => {
  const a = advanceAmount?.trim();
  if (!a) return null;
  const plain = a.replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(plain)) return `Rs. ${Number(plain).toLocaleString('en-IN')}`;
  return /^(rs\b|₹|inr\b)/i.test(a) || /%$/.test(a) ? a : `Rs. ${a}`;
};

/** Patterns are matched against the page text (text items joined by blanks, lines by newlines). */
const buildReplacements = ({ date, companyName, replacementGuarantee, serviceFee, advanceAmount }) => {
  const list = [];
  const token = (targets, text) => targets.forEach((t) => list.push({ re: new RegExp(escapeRe(t), 'gi'), group: 0, text }));

  if (date) {
    token(['xxx_date', '[date]', '{{date}}', 'date xxx'], date);
  }
  if (companyName) {
    // The sentence "... services to <client>. We appreciate ..." – works for placeholders and for old client names.
    list.push({ re: /services\s+to\s+([\s\S]+?)\s*\.?\s*We\s+appreciate/gi, group: 1, text: companyName });
    // Closing paragraphs of the Manvian-branded template, e.g. "... add substantial value to
    // <client> and help secure ..." and "... contributing to <client>['s] continued success."
    list.push({ re: /add\s+substantial\s+value\s+to\s+([\s\S]+?)\s+and\s+help\s+secure/gi, group: 1, text: companyName });
    list.push({ re: /contributing\s+to\s+([\s\S]+?)\s+continued\s+success/gi, group: 1, text: companyName });
    token(['xxx_company', '[company]', '{{company}}', 'company xxx', 'XXXX[Company Name]', '[Company Name]', "XXXX[Company's Name]", "[Company's Name]"], companyName);
    // Literal placeholder client name baked into that same template's sample copy, wherever it
    // recurs (full "Sharp Associates Asset Developers" or the short "Sharp Associates" form).
    list.push({ re: /Sharp\s+Associates(?:\s+Asset\s+Developers)?/gi, group: 0, text: companyName });
  }
  if (replacementGuarantee) {
    let g = replacementGuarantee.trim();
    if (/^\d+$/.test(g)) { const n = parseInt(g, 10); g = `${n} ${n === 1 ? 'month' : 'months'}`; }
    list.push({ re: /replacement\s+guarantee\s+is\s+([\s\S]+?)\s+from\s+the/gi, group: 1, text: g });
    token(['XXmonths', 'XX months', 'XXmonth', 'XX month', 'xxx_months', '[months]'], g);
  }

  let fee = serviceFee?.trim();
  if (fee && /^\d+(\.\d+)?$/.test(fee)) fee += '%';
  // "Advance / Booking Fee: Rs . XX%" – the advance amount when one is given, otherwise the fee percentage
  const advance = formatAdvance(advanceAmount) || fee;
  if (advance) list.push({ re: /Rs\s*\.\s*XX\s*%/gi, group: 0, text: advance });
  if (fee) {
    list.push({ re: /standard\s+service\s+fee\s+for\s+recruitment\s+is\s+([\s\S]+?)\s+of\s+the/gi, group: 1, text: fee });
    // Fee Structure lines that restate the service fee percentage
    list.push({ re: /(\d+(?:\.\d+)?\s*%)\s+of\s+candidate['’]s\s+annual\s+CTC/gi, group: 1, text: fee });
    list.push({ re: /within\s+the\s+(\d+(?:\.\d+)?\s*%)\s+service\s+fee/gi, group: 1, text: fee });
    token(['xxx_%', 'xxx%', 'xx %', 'xx%', '[fee]'], fee);
  }
  return list;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The date as typed, followed by shorter spellings of the same day to fall back on when it is too wide. */
const dateCandidates = (value) => {
  if (!value) return [];
  const out = [value];
  const d = new Date(value.replace(/,/g, ', '));
  if (!Number.isNaN(d.getTime()) && /\d{4}/.test(value)) {
    const month = MONTHS[d.getMonth()];
    [`${d.getDate()} ${month}, ${d.getFullYear()}`, `${d.getDate()} ${month.slice(0, 3)}, ${d.getFullYear()}`].forEach((alt) => {
      if (!out.includes(alt)) out.push(alt);
    });
  }
  return out;
};

/**
 * Date : / To : header lines – filled by label, so blank, placeholder and old values are all handled.
 * The line is rewritten as "<label> <value>" in the label's own font, on one line at the template's size.
 */
const fillHeaderFields = (page, pageLines, values, ctx) => {
  const { font, safe, pageW, bannerY, banner, headerColor } = ctx;
  const fields = [
    // The date sits directly above "To :", so it must stay on one line.
    { re: /^\s*date\s*:/i, label: 'Date :', candidates: dateCandidates(values.date) },
    // The recipient (the form's "To" field) only ever fills this header line; the form's separate
    // "Company Name" drives the placeholders in the body text.
    { re: /^\s*to\s*:/i, label: 'To :', candidates: values.recipient ? [values.recipient] : [] },
  ];
  pageLines.filter((l) => l.y > bannerY).forEach((line) => {
    fields.forEach(({ re, label, candidates }) => {
      if (!candidates.length) return;
      const idx = line.items.findIndex((i) => re.test(i.str));
      if (idx < 0) return;
      const labelItem = line.items[idx];
      const size = fontSizeOf(labelItem);
      const labelFamily = !labelItem.family || labelItem.family === 'other' ? 'helvetica' : labelItem.family;
      const f = font(ctx.value.family === 'auto' ? labelFamily : ctx.value.family, labelItem.bold || ctx.value.bold, labelItem.italic || ctx.value.italic);
      const x = labelItem.transform[4];
      const maxW = pageW - HEADER_RIGHT_MARGIN - x;
      const texts = candidates.map((c) => safe(`${label} ${c}`, f));

      // Always the template's own size: a date that is too wide falls back to a shorter spelling of the
      // same day, anything else is cut with "...".
      const fs = size;
      const text = texts.find((t) => f.widthOfTextAtSize(t, fs) <= maxW) || ellipsize(texts[texts.length - 1], f, fs, maxW);

      line.items.slice(idx).forEach((item) => {
        const s = fontSizeOf(item);
        page.drawRectangle({ x: item.transform[4] - 0.75, y: item.transform[5] - s * 0.3, width: item.width + 1.5, height: s * 1.3, color: rgb(banner.r, banner.g, banner.b) });
      });
      page.drawText(text, { x, y: labelItem.transform[5], size: fs, font: f, color: rgb(headerColor.r, headerColor.g, headerColor.b) });
    });
  });
};

/* ── table ─────────────────────────────────────────────────────────────── */

// One text size for every cell of every row. When there are many rows only the padding tightens;
// rows that still do not fit continue on an extra page.
const LEVELS = [
  { fs: 10, padX: 5, padY: 8, minH: 30 },
  { fs: 10, padX: 5, padY: 5, minH: 24 },
  { fs: 10, padX: 4, padY: 3, minH: 19 },
];

const rowCells = (row, index) => [String(index + 1), row?.role ?? '', String(row?.positions ?? ''), row?.qualifications ?? '', row?.package ?? ''];

const layoutRow = (cells, cols, lvl, fonts, safe) => {
  const sizes = [];
  const wrapped = cells.map((raw, c) => {
    const font = c === 1 ? fonts.bold : fonts.regular;
    const maxW = cols[c + 1] - cols[c] - lvl.padX * 2;
    sizes.push(lvl.fs);
    return wrapText(safe(raw, font), font, lvl.fs, maxW);
  });
  const lineH = lvl.fs * 1.25;
  const natural = Math.max(...wrapped.map((w) => w.length)) * lineH + lvl.padY * 2;
  return { wrapped, sizes, height: Math.max(natural, lvl.minH), lineH };
};

const drawRow = (page, layout, yTop, cols, lvl, fonts) => {
  layout.wrapped.forEach((lines, c) => {
    const font = c === 1 ? fonts.bold : fonts.regular;
    const centerX = (cols[c] + cols[c + 1]) / 2;
    const centerY = yTop - layout.height / 2;
    const fs = layout.sizes[c];
    lines.forEach((ln, k) => {
      if (!ln) return;
      const lineCenter = centerY + ((lines.length - 1) / 2 - k) * layout.lineH;
      page.drawText(ln, {
        x: centerX - font.widthOfTextAtSize(ln, fs) / 2,
        y: lineCenter - fs * 0.35,
        size: fs,
        font,
        color: rgb(0.07, 0.07, 0.12),
      });
    });
  });
};

const drawLine = (page, x1, y1, x2, y2, th) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: th, color: rgb(0, 0, 0) });

const applyTable = (page, table, pageLines, rows, ctx) => {
  const { fonts, safe } = ctx;
  const { cols, headerBottom, bottom, lw } = table;
  const left = cols[0];
  const right = cols[cols.length - 1];
  const bodyTop = headerBottom - lw / 2;
  const bodyBottom = bottom + lw / 2;
  const bodyH = bodyTop - bodyBottom;

  // 1. wipe what the template had inside the body (text + old row separators) without touching the watermark
  const white = rgb(1, 1, 1);
  pageLines.forEach((l) => l.items.forEach((i) => {
    const x = i.transform[4];
    const y = i.transform[5];
    if (x >= left - 1 && x <= right + 1 && y < headerBottom - 1 && y > bottom + 1) {
      const size = fontSizeOf(i);
      page.drawRectangle({ x: x - 0.8, y: y - size * 0.35, width: i.width + 1.6, height: size * 1.5, color: white });
    }
  }));
  table.seps.forEach((sy, k) => {
    // the template's own row dividers are wiped across the full width (keeping the watermark behind them) ...
    const band = lw + 1.6;
    const fills = table.sepFills?.[k] || [{ x0: left - lw, x1: right + lw, color: { r: 1, g: 1, b: 1 } }];
    fills.forEach(({ x0, x1, color }) => page.drawRectangle({ x: x0, y: sy - band, width: x1 - x0, height: band * 2, color: rgb(color.r, color.g, color.b) }));
  });
  // ... and the column rules are then redrawn over their whole height, so no notch shows where a divider was
  if (table.seps.length && !table.guessed) cols.forEach((x) => drawLine(page, x, table.top + lw / 2, x, bottom - lw / 2, lw));

  // 2. choose the largest text size at which the rows fit the body
  let lvl = LEVELS[LEVELS.length - 1];
  let layouts = null;
  for (const candidate of LEVELS) {
    const l = rows.map((r, i) => layoutRow(rowCells(r, i), cols, candidate, fonts, safe));
    if (l.reduce((s, x) => s + x.height, 0) <= bodyH) { lvl = candidate; layouts = l; break; }
    if (candidate === LEVELS[LEVELS.length - 1]) { lvl = candidate; layouts = l; }
  }

  // 3. anything that still doesn't fit goes to continuation pages
  let used = 0;
  let fit = 0;
  while (fit < layouts.length && (fit === 0 || used + layouts[fit].height <= bodyH)) { used += layouts[fit].height; fit++; }
  const overflowFrom = fit < layouts.length ? fit : -1;
  layouts = layouts.slice(0, fit);

  // spread spare height over the rows (bounded) so the table keeps the template's proportions
  const slack = bodyH - used;
  const extra = slack > 0 ? Math.min(slack / fit, 60) : 0;
  let y = bodyTop;
  layouts.forEach((lay, i) => {
    lay.height += extra;
    drawRow(page, lay, y, cols, lvl, fonts);
    y -= lay.height;
    if (i < layouts.length - 1) drawLine(page, left, y, right, y, lw);
  });
  if (table.guessed) {
    drawLine(page, left, table.top, right, table.top, lw);
    drawLine(page, left, headerBottom, right, headerBottom, lw);
    cols.forEach((x) => drawLine(page, x, table.top, x, bottom, lw));
    drawLine(page, left, bottom, right, bottom, lw);
  } else if (layouts.length && y - bodyBottom > 0.5 && y - bodyBottom < bodyH) {
    drawLine(page, left, y, right, y, lw); // close the last row if the body is not fully used
  }
  return { overflowFrom, lvl };
};

const addContinuationPages = async (pdfDoc, job, ctx) => {
  const { fonts, safe, pageH, pageY0, sourceDoc, fillHeader } = ctx;
  const { pageIndex, table, rows, from, lvl } = job;
  const { cols, lw } = table;
  const left = cols[0];
  const right = cols[cols.length - 1];
  // a page that carries the banner + footer (indexes refer to the pristine template)
  const frameIdx = pageIndex + 1 < sourceDoc.getPageCount() ? pageIndex + 1 : pageIndex;
  const bannerTop = pageY0 + pageH * BANNER_RATIO;
  const contentTop = bannerTop - 18;
  const contentBottom = pageY0 + pageH * FOOTER_RATIO + 22;
  const headerH = 30;
  const headFs = Math.min(table.headerSize || 10, 11);

  let cursor = from;
  let insertAt = pageIndex + 1;
  while (cursor < rows.length) {
    // Copied from the untouched template, not from the document being filled: copying a page of `pdfDoc`
    // would flush it, and pdf-lib cannot embed a subset font twice.
    const [copy] = await pdfDoc.copyPages(sourceDoc, [frameIdx]);
    fillHeader(copy, frameIdx);
    // marks the page as generated, so it is dropped when the template is restored from a filled file
    copy.node.set(PDFName.of(CONTINUATION_KEY), PDFBool.True);
    const { width } = copy.getSize();
    // clear everything between the banner and the footer band that the copied page carried
    const clearBottom = pageY0 + pageH * FOOTER_CLEAR_RATIO;
    copy.drawRectangle({ x: 0, y: clearBottom, width, height: bannerTop - 8 - clearBottom, color: rgb(1, 1, 1) });
    copy.drawText('POSITION REQUIREMENTS (CONTD.):', { x: left, y: contentTop - 14, size: 14, font: fonts.bold, color: rgb(0, 0, 0) });

    const tableTop = contentTop - 32;
    const avail = tableTop - headerH - contentBottom;
    const chunk = [];
    let h = 0;
    for (let i = cursor; i < rows.length; i++) {
      const lay = layoutRow(rowCells(rows[i], i), cols, lvl, fonts, safe);
      if (chunk.length && h + lay.height > avail) break;
      chunk.push(lay); h += lay.height;
    }

    // header row
    drawLine(copy, left, tableTop, right, tableTop, lw);
    drawLine(copy, left, tableTop - headerH, right, tableTop - headerH, lw);
    TABLE_HEADERS.forEach((label, c) => {
      const w = fonts.bold.widthOfTextAtSize(label, headFs);
      copy.drawText(label, { x: (cols[c] + cols[c + 1]) / 2 - w / 2, y: tableTop - headerH / 2 - headFs * 0.35, size: headFs, font: fonts.bold, color: rgb(0, 0, 0) });
    });
    let y = tableTop - headerH;
    chunk.forEach((lay) => { drawRow(copy, lay, y, cols, lvl, fonts); y -= lay.height; drawLine(copy, left, y, right, y, lw); });
    cols.forEach((x) => drawLine(copy, x, tableTop, x, y, lw));

    pdfDoc.insertPage(insertAt, copy);
    insertAt += 1;
    cursor += chunk.length;
  }
  return insertAt - (pageIndex + 1);
};

/* ────────────────────────────────────────────────────────────────────────────
 * Public entry point
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * @param pdfBytes  the pristine template
 * @param analysis  result of analyzeTemplate() for the same bytes
 * @param values    { date, recipient, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, positions }
 * @param style     { valueFont: 'auto' | 'Helvetica' | 'Times New Roman', isBold, isItalic, textColor }
 * @param options   { templateEdits } – wording changed in the template editor: { [blockId]: runs }
 *                  { fontLoader } – override how bundled font files are fetched (tests)
 */
export async function fillQuotation(pdfBytes, analysis, values, style = {}, options = {}) {
  const warnings = new Set();
  const unsupported = new Set();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const { valueFont = 'auto', isBold = true, isItalic = false, textColor = DEFAULT_TEXT_COLOR } = style;
  const valueFamily = valueFont === 'Times New Roman' ? 'times' : valueFont === 'Helvetica' ? 'helvetica' : 'auto';
  // values follow the colour of the text around them unless a colour was picked in the toolbar
  const pickedColor = textColor && textColor.toLowerCase() !== DEFAULT_TEXT_COLOR ? hexToRgb(textColor) : null;
  const value = { family: valueFamily, bold: isBold, italic: isItalic, color: pickedColor };

  const clean = {
    date: values.date?.trim(),
    companyName: values.companyName?.trim(),
    recipient: values.recipient?.trim(),
    replacementGuarantee: values.replacementGuarantee?.trim(),
    serviceFee: values.serviceFee?.trim(),
    advanceAmount: values.advanceAmount?.trim(),
  };
  const replacements = buildReplacements(clean);

  const positions = (values.positions || []).slice(0, MAX_ROWS);
  const requested = Math.min(MAX_ROWS, parseInt(values.totalRequirements || '0', 10) || 0);
  const rowCount = Math.max(positions.length, requested);
  const rows = Array.from({ length: rowCount }, (_, i) => positions[i] || null);

  // 1. find what has to change on each page (no fonts needed yet)
  const pages = pdfDoc.getPages();
  const templateEdits = options.templateEdits || {};
  const hasTemplateEdits = Object.keys(templateEdits).length > 0;
  const plans = pages.map((page, p) => {
    const rawLines = analysis.pdfLines.filter((l) => l.page === p + 1);
    const pageY0 = page.getMediaBox().y;
    const { width: pageW, height: pageH } = page.getSize();
    const geometry = { rawLines, pageW, pageH, pageY0, pageX0: page.getMediaBox().x, bannerY: pageY0 + pageH * BANNER_RATIO };
    if (!hasTemplateEdits) {
      const lines = segmentLines(rawLines);
      const chars = buildStream(lines);
      return { ...geometry, lines, chars, edits: findEdits(chars, replacements) };
    }
    // Blocks whose wording was changed in the template editor are rewritten as a whole (with the values
    // filled into the new wording); the value patterns then only run over the untouched rest of the page.
    const { lines, chars, blocks } = pageBlocks(analysis, p);
    const rewritten = blocks.filter((b) => b.editable && templateEdits[b.id]);
    const rewrittenLines = new Set(rewritten.flatMap((b) => b.group.lines));
    const edits = findEdits(chars, replacements).filter((ed) => !rewrittenLines.has(lines[chars[ed.s].line]) && !rewrittenLines.has(lines[chars[ed.e - 1].line]));
    rewritten.forEach((b) => edits.push({ s: b.s, e: b.e, group: b.group, runs: fillRuns(templateEdits[b.id], replacements) }));
    return { ...geometry, lines, chars, edits };
  });

  // 2. embed the fonts those changes need: the typefaces of the lines being re-typeset
  const wanted = [];
  const want = (family, bold, italic) => wanted.push({ family: !family || family === 'other' ? 'helvetica' : family, bold: Boolean(bold), italic: Boolean(italic) });
  if (valueFamily !== 'auto') { want(valueFamily, isBold, isItalic); want(valueFamily, true, isItalic); }
  plans.forEach((plan) => {
    plan.edits.forEach((ed) => (ed.runs || []).forEach((run) => {
      ed.group.lines.forEach((l) => l.items.forEach((i) => want(i.family, run.bold, run.italic)));
    }));
    if (plan.edits.length) {
      plan.lines.forEach((l) => l.items.forEach((i) => { want(i.family, i.bold, i.italic); want(i.family, false, false); want(i.family, isBold, isItalic); }));
    }
    plan.lines.filter((l) => l.y > plan.bannerY).forEach((l) => l.items.forEach((i) => {
      if (/^\s*(date|to)\s*:/i.test(i.str)) want(i.family, i.bold || isBold, i.italic || isItalic);
    }));
  });
  analysis.tables.forEach((t) => { want(t.family, false, false); want(t.family, true, false); });
  const font = await createFontBook(pdfDoc, wanted, { loader: options.fontLoader, warnings });
  const safe = makeSafeText(warnings, unsupported);
  const banner = analysis.bannerRgb || BANNER_RGB;
  const tableFonts = (table) => {
    const family = !table.family || table.family === 'other' ? 'helvetica' : table.family;
    return { regular: font(family, false, false), bold: font(family, true, false) };
  };

  // 3. write
  const continuations = [];
  let sourceDoc = null;
  const ctxOf = (plan) => ({
    font, safe, value, warnings, banner,
    pageW: plan.pageW,
    page: { width: plan.pageW, centreX: plan.pageX0 + plan.pageW / 2 },
    bannerY: plan.bannerY,
    defaultColor: hexToRgb(textColor),
    headerColor: hexToRgb(textColor),
  });
  // `p` is the page's index in the template, whose text lines describe the header
  const fillHeader = (page, p) => {
    try { fillHeaderFields(page, plans[p].rawLines, { date: clean.date, recipient: clean.recipient }, ctxOf(plans[p])); } catch (e) { console.error('Header fill failed:', e); }
  };
  pages.forEach((page, p) => {
    const plan = plans[p];
    const ctx = ctxOf(plan);

    fillHeader(page, p);
    // header lines are handled above; the body never re-typesets them
    const bodyEdits = plan.edits.filter((ed) => plan.lines[plan.chars[ed.s].line].y <= plan.bannerY);
    try { applyEdits(page, plan.lines, plan.chars, bodyEdits, ctx); } catch (e) { console.error('Text replacement failed:', e); }

    if (rowCount > 0) {
      analysis.tables.filter((t) => t.page === p + 1).forEach((table) => {
        try {
          const fonts = tableFonts(table);
          const { overflowFrom, lvl } = applyTable(page, table, plan.rawLines, rows, { fonts, safe });
          if (overflowFrom >= 0) continuations.push({ pageIndex: p, table, rows, from: overflowFrom, lvl, fonts });
        } catch (e) { console.error('Table fill failed:', e); }
      });
    }
  });

  // last tables first so earlier page indexes stay valid while inserting
  for (const job of continuations.sort((a, b) => b.pageIndex - a.pageIndex)) {
    const plan = plans[job.pageIndex];
    sourceDoc ||= await PDFDocument.load(pdfBytes);
    const added = await addContinuationPages(pdfDoc, job, { fonts: job.fonts, safe, pageH: plan.pageH, pageY0: plan.pageY0, sourceDoc, fillHeader });
    if (added) warnings.add(`${rows.length - job.from} position row(s) did not fit the table and continue on ${added} extra page(s).`);
  }

  if (unsupported.size) {
    const shown = [...unsupported].slice(0, 6).join(' ');
    warnings.add(`Some characters (${shown}${unsupported.size > 6 ? ' …' : ''}) cannot be printed in the PDF font and were replaced by "?".`);
  }
  return { bytes: await pdfDoc.save(), warnings: [...warnings] };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Template editing: rewrite the wording of the template itself
 * ────────────────────────────────────────────────────────────────────────── */

/** Blocks of one page with their place in the character stream. Shared by the listing and the rewrite. */
const pageBlocks = (analysis, p) => {
  const size = analysis.pageSizes[p];
  const lines = segmentLines(analysis.pdfLines.filter((l) => l.page === p + 1));
  const chars = buildStream(lines);
  const range = lines.map(() => null);
  chars.forEach((c, i) => { if (range[c.line]) range[c.line][1] = i + 1; else range[c.line] = [i, i + 1]; });
  const bannerY = size.y + size.height * BANNER_RATIO;
  const footerY = size.y + size.height * FOOTER_RATIO;

  const blocks = listBlocks(lines, { width: size.width, centreX: size.x + size.width / 2 }).map((g, index) => {
    const first = g.lines[0];
    const last = g.lines[g.lines.length - 1];
    // leading symbols in a font we cannot reproduce (bullets, arrows) are not part of the editable text
    const lead = first.items.findIndex((i, k) => i.family !== 'other' || k === first.items.length - 1);
    const [from] = range[lines.indexOf(first)];
    let s = from;
    while (s < chars.length && chars[s].item !== first.items[lead]) s++;
    let e = range[lines.indexOf(last)][1];
    while (e > s && !chars[e - 1].item) e--;

    const items = g.lines.flatMap((l) => l.items);
    // The Date / To lines are filled per quotation; the footer is light text on a dark band whose colours cannot be read back.
    const editable = first.y <= bannerY && last.y >= footerY && items.some((i) => i.family !== 'other');
    return {
      id: `${p + 1}:${index}`, page: p + 1, group: g, s, e, editable,
      box: {
        x0: Math.min(...g.lines.map((l) => l.minX)),
        x1: Math.max(...g.lines.map((l) => l.maxX)),
        yTop: first.base + first.height * 0.95,
        yBottom: last.base - last.height * 0.3,
      },
    };
  });
  return { lines, chars, blocks, range, size, bannerY };
};

/**
 * Applies the value patterns to rewritten template text. Returns the runs with every match replaced by a
 * `{ value: true }` run, so "xx%" typed into an edited paragraph is still filled in like in the original.
 */
const fillRuns = (runs, replacements) => {
  const text = runs.map((r) => r.text).join('');
  const owner = [];
  runs.forEach((r, k) => { for (let i = 0; i < r.text.length; i++) owner.push(k); });
  const taken = new Array(text.length).fill(null);
  replacements.forEach(({ re, group, text: value }) => {
    const rx = new RegExp(re.source, re.flags.includes('d') ? re.flags : `${re.flags}d`);
    let m;
    while ((m = rx.exec(text)) !== null) {
      if (m[0].length === 0) { rx.lastIndex++; continue; }
      let s = m.index;
      let e = m.index + m[0].length;
      if (group) {
        if (!m.indices?.[group]) continue;
        [s, e] = m.indices[group];
      }
      while (s < e && /\s/.test(text[s])) s++;
      while (e > s && /\s/.test(text[e - 1])) e--;
      if (s >= e || taken.slice(s, e).some(Boolean)) continue;
      const mark = { value, s };
      for (let i = s; i < e; i++) taken[i] = mark;
    }
  });
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const mark = taken[i];
    if (mark) {
      if (i === mark.s) out.push({ text: mark.value, value: true });
      continue;
    }
    const src = runs[owner[i]];
    const lastRun = out[out.length - 1];
    if (lastRun && lastRun.src === src) lastRun.text += text[i];
    else out.push({ ...src, text: text[i], src });
  }
  return out.map(({ src, ...run }) => run);
};

/**
 * The editable text blocks of a template: [{ id, page, box, runs }] where `runs` is the block's text as
 * styled runs [{ text, bold, italic, color }]. `box` is in PDF points (origin bottom-left).
 */
export const listTemplateBlocks = (analysis) => analysis.pageSizes.flatMap((_, p) => {
  const { lines, chars, blocks, range } = pageBlocks(analysis, p);
  return blocks.filter((b) => b.editable).map(({ id, page, box, group, s, e }) => {
    const runs = [];
    // only the block's own lines: other blocks on the same height sit between them in the stream
    group.lines.forEach((line) => {
      const [from, to] = range[lines.indexOf(line)];
      for (let i = Math.max(from, s); i < Math.min(to, e); i++) {
        const c = chars[i];
        const lastRun = runs[runs.length - 1];
        if (!c.item) {
          if (!c.glue && lastRun && !/\s$/.test(lastRun.text)) lastRun.text += ' '; // item gap or line break
          continue;
        }
        if (c.item.family === 'other') continue;
        const style = { bold: Boolean(c.item.bold), italic: Boolean(c.item.italic), color: c.item.color || null };
        const same = lastRun && lastRun.bold === style.bold && lastRun.italic === style.italic && JSON.stringify(lastRun.color) === JSON.stringify(style.color);
        if (same) lastRun.text += c.ch;
        else runs.push({ ...style, text: c.ch });
      }
    });
    if (runs.length) runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
    return { id, page, box, runs };
  });
});

/**
 * Rewrites text blocks of the template. Each block is set again in its own font, size, letter-spacing and
 * alignment; the lines re-wrap inside the block's margins.
 *
 * @param edits  { [blockId]: runs } with runs = [{ text, bold, italic, color }] (ids from listTemplateBlocks)
 */
export async function editTemplateText(pdfBytes, analysis, edits, options = {}) {
  const warnings = new Set();
  const unsupported = new Set();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const jobs = pages.map((page, p) => {
    const info = pageBlocks(analysis, p);
    const pageEdits = info.blocks
      .filter((b) => b.editable && edits[b.id])
      .map((b) => ({ s: b.s, e: b.e, group: b.group, runs: edits[b.id] }));
    return { page, ...info, pageEdits };
  }).filter((job) => job.pageEdits.length);

  const wanted = [];
  jobs.forEach((job) => job.pageEdits.forEach((ed) => {
    const families = new Set(ed.group.lines.flatMap((l) => l.items.map((i) => (!i.family || i.family === 'other' ? 'helvetica' : i.family))));
    families.forEach((family) => {
      wanted.push({ family, bold: false, italic: false });
      ed.runs.forEach((run) => wanted.push({ family, bold: Boolean(run.bold), italic: Boolean(run.italic) }));
    });
  }));
  const font = await createFontBook(pdfDoc, wanted, { loader: options.fontLoader, warnings });
  const safe = makeSafeText(warnings, unsupported);
  const black = { r: 0, g: 0, b: 0 };

  jobs.forEach(({ page, lines, chars, pageEdits, size, bannerY }) => {
    applyEdits(page, lines, chars, pageEdits, {
      font, safe, warnings,
      value: { family: 'auto', bold: false, italic: false, color: null },
      defaultColor: black,
      banner: analysis.bannerRgb || BANNER_RGB,
      bannerY,
      pageW: size.width,
      page: { width: size.width, centreX: size.x + size.width / 2 },
    });
  });

  if (unsupported.size) warnings.add(`Some characters (${[...unsupported].slice(0, 6).join(' ')}) cannot be printed in the template font and were replaced by "?".`);
  return { bytes: await pdfDoc.save(), warnings: [...warnings] };
}

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Quotation fill engine.
 *
 * Works on three kinds of templates:
 *   1. blank templates with placeholders (XXXX, xx%, [Company Name] ...)
 *   2. previously filled quotations whose values must be overwritten
 *   3. quotations whose Date / To lines are blank (label only, no placeholder)
 *
 * Everything is anchored on what is really in the PDF (labels, sentences, and the
 * table grid measured from a raster of the page) rather than on fixed coordinates.
 * All coordinates below are PDF points with the origin at the bottom-left.
 */

// Header banner (cyan) starts above this fraction of the page height; footer band ends below FOOTER_RATIO.
const BANNER_RATIO = 0.845;
const FOOTER_RATIO = 0.095;
const FOOTER_CLEAR_RATIO = 0.075; // continuation pages are wiped down to here (the footer band sits just below)
const BANNER_RGB = { r: 0x13 / 255, g: 0xb6 / 255, b: 0xd7 / 255 };
const RIGHT_MARGIN = 26;
const MAX_ROWS = 200;

const TABLE_KEYS = ['s.no', 'role', 'positions', 'qualifications', 'package'];
const TABLE_HEADERS = ['S.No', 'Role', 'No of Positions', 'Qualifications', 'Package'];

const CHAR_FALLBACK = {
  '₹': 'Rs. ', '–': '-', '—': '-', '−': '-', '‑': '-', '…': '...',
  '\u00a0': ' ', '\u2009': ' ', '\u200b': '', '×': 'x', '→': '->', '⟶': '->',
};

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 } : { r: 0.07, g: 0.09, b: 0.15 };
};

const fontSizeOf = (item) => Math.abs(item.transform[3]) || item.height || 12;

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

const groupIntoLines = (items, pageNum) => {
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
  const hLines = groups
    .filter((g) => Math.abs(g.xL - widest.xL) < 6 && Math.abs(g.xR - widest.xR) < 6)
    .map((g) => ({ y: toPt((g.y0 + g.y1 + 1) / 2), th: (g.y1 - g.y0 + 1) / scale }))
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
    lw: Math.max(0.6, Math.min(1.6, headerBottom.th)),
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

export async function analyzeTemplate(pdfjsLib, pdfBytes, { rasterize = defaultRasterize } = {}) {
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
    const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ ...i, pageNum: p }));
    const lines = groupIntoLines(items, p);
    pdfLines.push(...lines);

    lines.filter((l) => l.y > origin.y + vp.height * BANNER_RATIO).forEach((l) => {
      const d = /date\s*:\s*(.+)$/i.exec(l.str);
      const t = /\bto\s*:\s*(.+)$/i.exec(l.str);
      if (d && !extracted.date && !/x{3,}/i.test(d[1])) extracted.date = d[1].trim();
      if (t && !extracted.company && !/x{3,}/i.test(t[1])) extracted.company = t[1].trim();
    });

    if (!bannerRgb) {
      const hdr = lines.find((l) => l.y > origin.y + vp.height * BANNER_RATIO && /^\s*(date|to)\s*:/i.test(l.items[0].str));
      if (hdr) {
        try {
          // sample a blank pixel of the banner just right of the header text so erased patches match exactly
          const img = await rasterize(page, 1);
          const px = Math.round(hdr.maxX + 12 - origin.x);
          const py = Math.round(origin.y + vp.height - (hdr.y + hdr.height * 0.35));
          if (px > 0 && px < img.width - 2 && py > 0 && py < img.height) {
            const i = (py * img.width + px) * 4;
            if (img.data[i + 3] > 200) bannerRgb = { r: img.data[i] / 255, g: img.data[i + 1] / 255, b: img.data[i + 2] / 255 };
          }
        } catch { /* keep the default banner colour */ }
      }
    }

    const headerLine = lines.find((l) => TABLE_KEYS.filter((k) => l.str.toLowerCase().includes(k)).length >= 3);
    if (!headerLine) continue;
    const noteLine = lines.find((l) => l.y < headerLine.y && /^note\s*:/i.test(l.str.trim()));
    let grid = null;
    try {
      const scale = 2;
      const img = await rasterize(page, scale);
      const floor = noteLine ? noteLine.y + 2 : headerLine.y - 520;
      grid = detectGrid(img, scale, vp.height, origin, headerLine.y, floor);
      if (grid && grid.cols.length !== TABLE_HEADERS.length + 1) grid = null; // unexpected column count -> don't trust it
    } catch (err) {
      console.warn('Table grid detection failed, using text-based estimate:', err);
    }
    tables.push({ page: p, headerY: headerLine.y, noteLine: noteLine || null, ...(grid || guessGrid(headerLine, noteLine, vp.width)) });
  }

  return { pdfLines, tables, pageSizes, extracted, bannerRgb };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Filling
 * ────────────────────────────────────────────────────────────────────────── */

const makeTextTools = (font, warnings, unsupported) => {
  let supported = null;
  try { supported = new Set(font.getCharacterSet()); } catch { /* not a standard font */ }
  return (text) => {
    let out = '';
    for (const ch of String(text ?? '').replace(/[\r\n\t]+/g, ' ')) {
      const cp = ch.codePointAt(0);
      if (!supported || supported.has(cp)) out += ch;
      else if (CHAR_FALLBACK[ch] !== undefined) { out += CHAR_FALLBACK[ch]; if (ch === '₹') warnings.add('₹ is printed as "Rs." (the PDF font has no rupee sign).'); }
      else { out += '?'; unsupported.add(ch); }
    }
    return out;
  };
};

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

/**
 * Re-typesets the paragraph that contains a replaced span. Used when a long value cannot be patched in place
 * without running into the text that follows it. Bold runs are kept, lines are wrapped and justified to the
 * paragraph's own margins, and the line count is capped so it never runs into the next block.
 */
const planReflow = ({ lines, chars, spanItem, s, e, newText, fonts, textRgb }) => {
  const idx = lines.findIndex((l) => l.items.includes(spanItem));
  const near = (a, b) => Math.abs(a.y - b.y) < 26 && Math.abs(a.minX - b.minX) < 6;
  let from = idx;
  let to = idx;
  while (from > 0 && near(lines[from - 1], lines[from])) from--;
  while (to < lines.length - 1 && near(lines[to], lines[to + 1])) to++;
  const para = lines.slice(from, to + 1);
  const items = new Set(para.flatMap((l) => l.items));

  // the font used for most characters is the regular one, the other is treated as bold
  const usage = new Map();
  items.forEach((i) => usage.set(i.fontName, (usage.get(i.fontName) || 0) + i.str.length));
  const regularFont = [...usage.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const tokens = [];
  let cur = null;
  const flush = () => { if (cur) tokens.push(cur); cur = null; };
  const first = chars.findIndex((c) => c.item && items.has(c.item));
  let last = first;
  chars.forEach((c, i) => { if (c.item && items.has(c.item)) last = i; });
  let inserted = false;
  for (let i = first; i <= last; i++) {
    const c = chars[i];
    if (i >= s && i < e) {
      if (!inserted) {
        flush();
        newText.split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ text: w, bold: true, custom: true }));
        inserted = true;
      }
      continue;
    }
    if (!c.item || /\s/.test(c.ch)) { flush(); continue; }
    if (!items.has(c.item)) continue;
    if (!cur) cur = { text: '', bold: c.item.fontName !== regularFont };
    cur.text += c.ch;
  }
  flush();
  // a lone period / comma belongs to the word before it
  const words = [];
  tokens.forEach((t) => {
    if (words.length && /^[.,;:!?]+$/.test(t.text)) words[words.length - 1] = { ...words[words.length - 1], text: words[words.length - 1].text + t.text };
    else words.push(t);
  });

  const size0 = fontSizeOf(para[0].items[0]);
  const left = Math.min(...para.map((l) => l.minX));
  const width = Math.max(...para.map((l) => l.maxX)) - left;
  const lead = para.length > 1 ? (para[0].y - para[para.length - 1].y) / (para.length - 1) : size0 * 1.3;
  const below = lines[to + 1];
  const spare = below ? Math.max(0, Math.floor((para[para.length - 1].y - below.y - size0 * 1.5) / lead)) : 1;
  const maxLines = para.length + spare;
  const fontOf = (t) => (t.bold ? fonts.bold : fonts.regular);

  const layout = (size) => {
    const rows = [];
    let row = [];
    let w = 0;
    const space = fonts.regular.widthOfTextAtSize(' ', size);
    words.forEach((t) => {
      const tw = fontOf(t).widthOfTextAtSize(t.text, size);
      if (row.length && w + space + tw > width) { rows.push(row); row = []; w = 0; }
      w += (row.length ? space : 0) + tw;
      row.push({ ...t, w: tw });
    });
    if (row.length) rows.push(row);
    return rows;
  };
  let size = size0;
  let rows = layout(size);
  for (const sc of [0.95, 0.9, 0.85, 0.8, 0.75]) {
    if (rows.length <= maxLines) break;
    size = size0 * sc;
    rows = layout(size);
  }

  const draw = (page) => {
    const space = fonts.regular.widthOfTextAtSize(' ', size);
    rows.forEach((row, k) => {
      const y = para[0].y - k * lead;
      const natural = row.reduce((sum, t) => sum + t.w, 0);
      const justify = k < rows.length - 1 && row.length > 1;
      const gap = justify ? Math.min((width - natural) / (row.length - 1), space * 3) : space;
      let x = left;
      row.forEach((t) => {
        const c = t.custom ? textRgb : { r: 0, g: 0, b: 0 };
        page.drawText(t.text, { x, y, size, font: fontOf(t), color: rgb(c.r, c.g, c.b) });
        x += t.w + gap;
      });
    });
  };
  return { items, draw };
};

const escapeRe = (s) => s.trim().replace(/\s+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+').replace(/['’]/g, "['’]");

const buildReplacements = ({ date, companyName, replacementGuarantee, serviceFee }) => {
  const list = [];
  const token = (targets, text) => targets.forEach((t) => list.push({ re: new RegExp(escapeRe(t), 'gi'), group: 0, text }));

  if (date) {
    token(['xxx_date', '[date]', '{{date}}', 'date xxx'], date);
  }
  if (companyName) {
    // The sentence "... services to <client>. We appreciate ..." – works for placeholders and for old client names.
    list.push({ re: /services\s+to\s+([\s\S]+?)\s*\.?\s*We\s+appreciate/gi, group: 1, text: companyName, reflow: true });
    token(['xxx_company', '[company]', '{{company}}', 'company xxx', 'XXXX[Company Name]', '[Company Name]', "XXXX[Company's Name]", "[Company's Name]"], companyName);
  }
  if (replacementGuarantee) {
    let g = replacementGuarantee.trim();
    if (/^\d+$/.test(g)) { const n = parseInt(g, 10); g = `${n} ${n === 1 ? 'month' : 'months'}`; }
    list.push({ re: /replacement\s+guarantee\s+is\s+([\s\S]+?)\s+from\s+the/gi, group: 1, text: g });
    token(['XXmonths', 'XX months', 'XXmonth', 'XX month', 'xxx_months', '[months]'], g);
  }
  if (serviceFee) {
    let f = serviceFee.trim();
    if (/^\d+(\.\d+)?$/.test(f)) f += '%';
    list.push({ re: /standard\s+service\s+fee\s+for\s+recruitment\s+is\s+([\s\S]+?)\s+of\s+the/gi, group: 1, text: f });
    list.push({ re: new RegExp(escapeRe('Rs . XX %'), 'gi'), group: 0, text: `Rs . ${f}` });
    token(['xxx_%', 'xxx%', 'xx %', 'xx%', '[fee]'], f);
  }
  return list;
};

/** Replace text spans found in the page's text stream, re-typesetting them inside the space each slot really has. */
const applyReplacements = (page, pageLines, replacements, ctx) => {
  if (!replacements.length || !pageLines.length) return;
  const { fonts, safe, pageW, bannerY, textRgb } = ctx;

  const lines = [...pageLines].sort((a, b) => b.y - a.y);
  const chars = [];
  lines.forEach((line) => {
    line.items.forEach((item, idx) => {
      if (idx > 0) chars.push({ ch: ' ', item: null });
      for (const ch of item.str) chars.push({ ch, item });
    });
    chars.push({ ch: '\n', item: null });
  });
  const stream = chars.map((c) => c.ch).join('');
  const touched = new Map(); // item -> { scale, inserts }
  const late = []; // draw calls that must run after the erase pass
  const moved = new Set(); // trailing items that are re-typeset after a longer value
  const shifts = [];

  // free width from an item's start to the next surviving item on its line (or the right margin)
  const freeWidth = (item, line) => {
    const nxt = line.items.find((i) => i.transform[4] > item.transform[4] + 0.5 && !touched.has(i) && !moved.has(i) && !chars.some((c) => c.item === i && c.gone));
    return (nxt ? nxt.transform[4] : pageW - RIGHT_MARGIN) - item.transform[4] - 3;
  };
  const lineOf = (item) => lines.find((l) => l.items.includes(item));

  replacements.forEach(({ re, group, text, reflow }) => {
    const rx = new RegExp(re.source, re.flags.includes('d') ? re.flags : `${re.flags}d`);
    let m;
    while ((m = rx.exec(stream)) !== null) {
      if (m[0].length === 0) { rx.lastIndex++; continue; }
      let s = m.index;
      let e = m.index + m[0].length;
      if (group && m.indices?.[group]) [s, e] = m.indices[group];
      else if (group && m[group]) { s = m.index + m[0].indexOf(m[group]); e = s + m[group].length; }
      if (chars.slice(s, e).some((c) => c.gone)) continue;

      const span = [];
      for (let i = s; i < e; i++) {
        if (chars[i].item && !span.includes(chars[i].item)) span.push(chars[i].item);
      }
      if (!span.length) continue;
      for (let i = s; i < e; i++) if (chars[i].item || chars[i].ch === ' ') chars[i].gone = true;
      // remember the new text for each item and where in it the insert goes
      span.forEach((item) => { if (!touched.has(item)) touched.set(item, { scale: 1, inserts: [] }); });

      // a lone "." / "," right after the span is a separate text item – pull it in so it hugs the new text
      let trailing = '';
      let nx = e;
      while (nx < chars.length && chars[nx].ch === ' ' && !chars[nx].item) nx++;
      if (nx < chars.length && chars[nx].item && /^[.,;]$/.test(chars[nx].item.str.trim())) {
        const punct = chars[nx].item;
        trailing = punct.str.trim();
        chars.forEach((c) => { if (c.item === punct) c.gone = true; });
        touched.set(punct, { scale: 1, inserts: [] });
      }

      const words = safe(text).split(/\s+/).filter(Boolean);
      if (trailing && words.length) words[words.length - 1] += trailing;
      // items of the span that share a line form one slot (e.g. "xx" and "%" are two text items of one value)
      const groups = [];
      span.forEach((item) => {
        const line = lineOf(item);
        const g = groups[groups.length - 1];
        if (g && g.line === line) g.items.push(item); else groups.push({ line, items: [item] });
      });
      const slots = groups.map(({ line, items }) => {
        const item = items[0];
        const kept = chars.filter((c) => c.item === item && !c.gone).map((c) => c.ch).join('');
        const size = fontSizeOf(item);
        const keptW = kept ? fonts.main.widthOfTextAtSize(kept, size) : 0;
        return { item, items, line, size, keptW, cap: freeWidth(item, line) - keptW };
      });

      const alloc = (scale) => {
        const buckets = slots.map(() => []);
        let k = 0;
        for (let w = 0; w < words.length; w++) {
          let placed = false;
          for (; k < slots.length; k++) {
            const cur = buckets[k];
            const trial = cur.length ? `${cur.join(' ')} ${words[w]}` : words[w];
            const fits = fonts.main.widthOfTextAtSize(trial, slots[k].size * scale) <= slots[k].cap;
            if (fits || k === slots.length - 1) { cur.push(words[w]); placed = true; break; }
          }
          if (!placed) buckets[slots.length - 1].push(words[w]);
        }
        const ok = buckets.every((b, i) => !b.length || fonts.main.widthOfTextAtSize(b.join(' '), slots[i].size * scale) <= slots[i].cap);
        return { buckets, ok };
      };
      let chosen = null;
      let scale = 1;
      const tryScales = (list) => {
        for (const sc of list) {
          const trial = alloc(sc);
          if (trial.ok) { chosen = trial; scale = sc; return true; }
        }
        return false;
      };

      // 1) fits as is (or after a slight shrink)
      let fitted = tryScales(reflow ? [1, 0.92, 0.85, 0.78, 0.7] : [1, 0.92]);
      // 2) too long for its slot: let the words that follow on the same line move along instead of shrinking the value
      if (!fitted && !reflow) {
        const tail = slots[slots.length - 1];
        const line = tail.line;
        const lastX = tail.items[tail.items.length - 1].transform[4];
        const suffix = line.items.filter((i) => i.transform[4] > lastX + 0.5 && !touched.has(i) && !moved.has(i) && !chars.some((c) => c.item === i && c.gone));
        if (suffix.length) {
          const space = fonts.regular.widthOfTextAtSize(' ', tail.size);
          const sufW = suffix.reduce((w, i) => w + fonts.regular.widthOfTextAtSize(i.str.trim(), fontSizeOf(i)), 0) + space * suffix.length;
          const original = tail.cap;
          // the line keeps its original right edge; the moved words are set in the (narrower) regular font
          tail.cap = Math.max(original, line.maxX - sufW - tail.item.transform[4] - tail.keptW - space);
          if (tryScales([1, 0.92, 0.85])) { fitted = true; suffix.forEach((i) => moved.add(i)); shifts.push({ item: tail.item, suffix }); }
          else tail.cap = original;
        }
      }
      // 3) last resort: shrink harder
      if (!fitted) { fitted = tryScales([0.85, 0.78, 0.7]); if (!fitted) { scale = 0.7; chosen = alloc(0.7); } }

      const lastUsed = chosen.buckets.reduce((acc, b, i) => (b.length ? i : acc), -1);
      const holeAfter = lastUsed >= 0 && lastUsed < slots.length - 1;
      const gapAfter = lastUsed >= 0 ? slots[lastUsed].cap - fonts.main.widthOfTextAtSize(chosen.buckets[lastUsed].join(' '), slots[lastUsed].size * scale) : 0;
      if (reflow && (!chosen.ok || holeAfter || gapAfter > 40)) {
        // would overflow, leave a hole or leave a wide gap before the following text: re-typeset the paragraph instead
        const plan = planReflow({ lines, chars, spanItem: span[0], s, e, newText: safe(text), fonts, textRgb });
        plan.items.forEach((item) => touched.set(item, { scale: 1, inserts: [] }));
        chars.forEach((c) => { if (c.item && plan.items.has(c.item)) c.gone = true; });
        late.push(plan.draw);
        continue;
      }
      slots.forEach((slot, i) => {
        slot.items.forEach((item, j) => {
          const t = touched.get(item);
          t.scale = Math.min(t.scale, scale);
          let at = s;
          while (at < e && chars[at].item !== item) at++;
          t.inserts.push({ at, text: j === 0 ? chosen.buckets[i].join(' ') : '' });
        });
      });
    }
  });

  // build final strings
  const rebuilt = new Map();
  touched.forEach((info, item) => {
    let str = '';
    let insertsLeft = [...info.inserts].sort((a, b) => a.at - b.at);
    chars.forEach((c, idx) => {
      if (c.item !== item) return;
      while (insertsLeft.length && insertsLeft[0].at <= idx) str += insertsLeft.shift().text;
      if (!c.gone) str += c.ch;
    });
    insertsLeft.forEach((i) => { str += i.text; });
    rebuilt.set(item, { str, scale: info.scale });
  });

  rebuilt.forEach((_, item) => {
    const size = fontSizeOf(item);
    const inBanner = item.transform[5] > bannerY;
    const bg = inBanner ? ctx.banner : { r: 1, g: 1, b: 1 };
    page.drawRectangle({ x: item.transform[4] - 0.5, y: item.transform[5] - size * 0.4, width: item.width + 1, height: size * 1.55, color: rgb(bg.r, bg.g, bg.b) });
  });
  moved.forEach((item) => {
    const size = fontSizeOf(item);
    page.drawRectangle({ x: item.transform[4] - 0.5, y: item.transform[5] - size * 0.4, width: item.width + 1, height: size * 1.55, color: rgb(1, 1, 1) });
  });
  rebuilt.forEach(({ str, scale }, item) => {
    if (!str.trim()) return;
    page.drawText(str, { x: item.transform[4], y: item.transform[5], size: fontSizeOf(item) * scale, font: fonts.main, color: rgb(textRgb.r, textRgb.g, textRgb.b) });
  });
  shifts.forEach(({ item, suffix }) => {
    const info = rebuilt.get(item);
    const size = fontSizeOf(item);
    const space = fonts.regular.widthOfTextAtSize(' ', size);
    let x = item.transform[4] + fonts.main.widthOfTextAtSize(info.str, size * info.scale) + space;
    suffix.forEach((i) => {
      const txt = i.str.trim();
      page.drawText(txt, { x, y: i.transform[5], size: fontSizeOf(i), font: fonts.regular, color: rgb(textRgb.r, textRgb.g, textRgb.b) });
      x += fonts.regular.widthOfTextAtSize(txt, fontSizeOf(i)) + space;
    });
  });
  late.forEach((draw) => draw(page));
};

/** Date : / To : header lines – filled by label, so blank, placeholder and old values are all handled. */
const fillHeaderFields = (page, pageLines, values, ctx) => {
  const { fonts, safe, pageW, bannerY, textRgb } = ctx;
  const fields = [
    { re: /^\s*date\s*:/i, label: 'Date :', value: values.date },
    { re: /^\s*to\s*:/i, label: 'To :', value: values.companyName },
  ];
  pageLines.filter((l) => l.y > bannerY).forEach((line) => {
    fields.forEach(({ re, label, value }) => {
      if (!value) return;
      const idx = line.items.findIndex((i) => re.test(i.str));
      if (idx < 0) return;
      const labelItem = line.items[idx];
      const labelOnly = labelItem.str.replace(re, '').trim() === '';
      const erase = labelOnly ? line.items.slice(idx + 1) : line.items.slice(idx);
      const size = fontSizeOf(labelItem);

      erase.forEach((i) => {
        page.drawRectangle({ x: i.transform[4] - 0.5, y: i.transform[5] - size * 0.35, width: i.width + 1, height: size * 1.5, color: rgb(ctx.banner.r, ctx.banner.g, ctx.banner.b) });
      });

      const x = labelOnly ? labelItem.transform[4] + labelItem.width + fonts.main.widthOfTextAtSize(' ', size) : labelItem.transform[4];
      let txt = safe(labelOnly ? value : `${label} ${value}`);
      let fs = size;
      const maxW = pageW - RIGHT_MARGIN - x;
      while (fonts.main.widthOfTextAtSize(txt, fs) > maxW && fs > size * 0.7) fs -= 0.25;
      while (txt.length > 6 && fonts.main.widthOfTextAtSize(txt, fs) > maxW) txt = `${txt.slice(0, -4).trimEnd()}...`;
      page.drawText(txt, { x, y: labelItem.transform[5], size: fs, font: fonts.main, color: rgb(textRgb.r, textRgb.g, textRgb.b) });
    });
  });
};

/* ── table ─────────────────────────────────────────────────────────────── */

const LEVELS = [
  { fs: 10, padX: 5, padY: 8, minH: 30 },
  { fs: 9, padX: 4, padY: 6, minH: 24 },
  { fs: 8, padX: 4, padY: 4, minH: 19 },
];

const rowCells = (row, index) => [String(index + 1), row?.role ?? '', String(row?.positions ?? ''), row?.qualifications ?? '', row?.package ?? ''];

const layoutRow = (cells, cols, lvl, fonts, safe) => {
  const sizes = [];
  const wrapped = cells.map((raw, c) => {
    const font = c === 1 ? fonts.bold : fonts.regular;
    const txt = safe(raw);
    const maxW = cols[c + 1] - cols[c] - lvl.padX * 2;
    // a cell that would only just wrap is shrunk (by up to 2pt) so it stays on one line
    let fs = lvl.fs;
    while (fs > Math.max(7, lvl.fs - 2) && font.widthOfTextAtSize(txt, fs) > maxW) fs -= 0.5;
    if (font.widthOfTextAtSize(txt, fs) > maxW) fs = lvl.fs;
    sizes.push(fs);
    return wrapText(txt, font, fs, maxW);
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
        color: c === 0 ? rgb(0.25, 0.25, 0.25) : rgb(0.07, 0.07, 0.12),
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
  table.seps.forEach((sy) => {
    for (let c = 0; c < cols.length - 1; c++) {
      page.drawRectangle({ x: cols[c] + lw / 2 + 0.2, y: sy - lw - 1.4, width: cols[c + 1] - cols[c] - lw - 0.4, height: lw * 2 + 2.8, color: white });
    }
  });

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
  const { fonts, safe, pageH, pageY0 } = ctx;
  const { pageIndex, table, rows, from, lvl } = job;
  const { cols, lw } = table;
  const left = cols[0];
  const right = cols[cols.length - 1];
  const pages = pdfDoc.getPages();
  const frameIdx = pageIndex + 1 < pages.length ? pageIndex + 1 : pageIndex; // a page that carries the banner + footer
  const bannerTop = pageY0 + pageH * BANNER_RATIO;
  const contentTop = bannerTop - 18;
  const contentBottom = pageY0 + pageH * FOOTER_RATIO + 22;
  const headerH = 30;

  let cursor = from;
  let insertAt = pageIndex + 1;
  while (cursor < rows.length) {
    // the frame page moves one slot for every continuation page already inserted before it
    const [copy] = await pdfDoc.copyPages(pdfDoc, [frameIdx === pageIndex ? frameIdx : frameIdx + (insertAt - (pageIndex + 1))]);
    const { width } = copy.getSize();
    // clear everything between the banner and the footer band that the copied page carried
    const clearBottom = pageY0 + pageH * FOOTER_CLEAR_RATIO;
    copy.drawRectangle({ x: 0, y: clearBottom, width, height: bannerTop - 8 - clearBottom, color: rgb(1, 1, 1) });
    copy.drawText('POSITION REQUIREMENTS (CONTD.):', { x: left, y: contentTop - 14, size: 13, font: fonts.bold, color: rgb(0, 0, 0) });

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
      const w = fonts.bold.widthOfTextAtSize(label, 10);
      copy.drawText(label, { x: (cols[c] + cols[c + 1]) / 2 - w / 2, y: tableTop - headerH / 2 - 3.5, size: 10, font: fonts.bold, color: rgb(0, 0, 0) });
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

export async function fillQuotation(pdfBytes, analysis, values, style = {}) {
  const warnings = new Set();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const { fontFamily = 'Montserrat', isBold = true, isItalic = false, textColor = '#111827' } = style;

  let mainFont = StandardFonts.Helvetica;
  if (fontFamily === 'Times New Roman') {
    mainFont = isBold && isItalic ? StandardFonts.TimesRomanBoldItalic : isBold ? StandardFonts.TimesRomanBold : isItalic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
  } else if (isBold && isItalic) mainFont = StandardFonts.HelveticaBoldOblique;
  else if (isBold) mainFont = StandardFonts.HelveticaBold;
  else if (isItalic) mainFont = StandardFonts.HelveticaOblique;

  const fonts = {
    main: await pdfDoc.embedFont(mainFont),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
  };
  const unsupported = new Set();
  const safe = makeTextTools(fonts.regular, warnings, unsupported);
  const textRgb = hexToRgb(textColor);

  const clean = {
    date: values.date?.trim(),
    companyName: values.companyName?.trim(),
    replacementGuarantee: values.replacementGuarantee?.trim(),
    serviceFee: values.serviceFee?.trim(),
  };
  const replacements = buildReplacements(clean);

  const positions = (values.positions || []).slice(0, MAX_ROWS);
  const requested = Math.min(MAX_ROWS, parseInt(values.totalRequirements || '0', 10) || 0);
  const rowCount = Math.max(positions.length, requested);
  const rows = Array.from({ length: rowCount }, (_, i) => positions[i] || null);

  const pages = pdfDoc.getPages();
  const continuations = [];
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    const { width: pageW, height: pageH } = page.getSize();
    const pageY0 = page.getMediaBox().y;
    const ctx = { fonts, safe, pageW, pageH, pageY0, bannerY: pageY0 + pageH * BANNER_RATIO, textRgb, banner: analysis.bannerRgb || BANNER_RGB };
    const pageLines = analysis.pdfLines.filter((l) => l.page === p + 1);

    try { fillHeaderFields(page, pageLines, { date: clean.date, companyName: clean.companyName }, ctx); } catch (e) { console.error('Header fill failed:', e); }
    try { applyReplacements(page, pageLines, replacements, ctx); } catch (e) { console.error('Text replacement failed:', e); }

    if (rowCount > 0) {
      analysis.tables.filter((t) => t.page === p + 1).forEach((table) => {
        try {
          const { overflowFrom, lvl } = applyTable(page, table, pageLines, rows, ctx);
          if (overflowFrom >= 0) continuations.push({ pageIndex: p, table, rows, from: overflowFrom, lvl });
        } catch (e) { console.error('Table fill failed:', e); }
      });
    }
  }

  // last tables first so earlier page indexes stay valid while inserting
  for (const job of continuations.sort((a, b) => b.pageIndex - a.pageIndex)) {
    const { height: pageH } = pdfDoc.getPage(job.pageIndex).getSize();
    const pageY0 = pdfDoc.getPage(job.pageIndex).getMediaBox().y;
    const added = await addContinuationPages(pdfDoc, job, { fonts, safe, pageH, pageY0 });
    if (added) warnings.add(`${rows.length - job.from} position row(s) did not fit the table and continue on ${added} extra page(s).`);
  }

  if (unsupported.size) {
    const shown = [...unsupported].slice(0, 6).join(' ');
    warnings.add(`Some characters (${shown}${unsupported.size > 6 ? ' …' : ''}) cannot be printed in the PDF font and were replaced by "?".`);
  }
  return { bytes: await pdfDoc.save(), warnings: [...warnings] };
}

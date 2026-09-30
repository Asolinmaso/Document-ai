import { CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX } from './templateBuilder';
import { groupIntoLines } from './quotationEngine';

/**
 * Best-effort conversion of an uploaded PDF (one that was not built in the Template Editor, so no widget
 * data was saved) into editor widgets: text lines / paragraphs, the Date and To labels, the position
 * table and the header banner. Logos, images and exact colours cannot be recovered from the text layer.
 */

const BANNER_RATIO = 0.845; // same constant the fill engine uses for the header band
const TABLE_KEYS = ['s.no', 'role', 'positions', 'qualifications', 'package'];
let seq = 0;
const nextId = (type) => `${type}-imp-${Date.now()}-${seq++}`;

export async function importPdfAsTemplate(pdfjsLib, pdfBytes) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const originX = page.view[0];
  const originY = page.view[1];
  const sx = CANVAS_WIDTH_PX / vp.width;
  const sy = CANVAS_HEIGHT_PX / vp.height;
  const toPxX = (xPt) => (xPt - originX) * sx;
  const toPxY = (yPt) => (originY + vp.height - yPt) * sy; // PDF y is measured from the bottom

  const tc = await page.getTextContent();
  const items = tc.items.filter((i) => i.str && i.str.trim());
  const lines = groupIntoLines(items, 1);
  const sizeOf = (l) => l.height || 12;
  const elements = [];

  const headerLine = lines.find((l) => TABLE_KEYS.filter((k) => l.str.toLowerCase().includes(k)).length >= 3);
  const noteLine = headerLine ? lines.find((l) => l.y < headerLine.y && /^note\s*:/i.test(l.str.trim())) : null;
  let tableBox = null;
  if (headerLine) {
    const top = headerLine.y + 24;
    const bottom = noteLine ? noteLine.y + noteLine.height + 8 : headerLine.y - 22 - 60;
    const left = Math.max(originX + 10, headerLine.minX - 10);
    const right = headerLine.maxX + 14;
    tableBox = { top, bottom };
    const rows = Math.max(1, Math.min(15, Math.round((top - 22 - bottom) / 55)));
    elements.push({
      id: nextId('table'), type: 'table', rows, fontFamily: 'Helvetica',
      x: toPxX(left), y: toPxY(top), width: (right - left) * sx, height: (top - bottom) * sy,
    });
  }

  const inTable = (l) => tableBox && l.y <= tableBox.top + 2 && l.y >= tableBox.bottom - 2;
  const isNote = (l) => noteLine && l === noteLine; // the builder re-emits this anchor note together with the table

  const hasBanner = lines.some((l) => l.y > originY + vp.height * BANNER_RATIO && /^\s*(date|to)\s*:/i.test(l.items[0].str));
  if (hasBanner) {
    elements.unshift({
      id: nextId('banner'), type: 'banner', x: 0, y: 0, width: CANVAS_WIDTH_PX,
      height: Math.round((1 - BANNER_RATIO) * CANVAS_HEIGHT_PX), bgColor: '#13B6D7',
    });
  }

  const base = { italic: false, underline: false, align: 'left', color: '#111827', fontFamily: 'Helvetica' };
  const labelField = (l, type) => {
    const size = sizeOf(l);
    elements.push({
      id: nextId(type), type, ...base, bold: true, fontSize: Math.round(size),
      x: toPxX(l.minX), y: toPxY(l.y + size), width: 220, height: Math.ceil(size * 1.5 * sy),
    });
  };

  // consecutive, similarly sized, left-aligned lines become one paragraph widget
  const free = lines.filter((l) => !inTable(l) && !isNote(l));
  const used = new Set();
  free.forEach((l, idx) => {
    if (used.has(l)) return;
    if (/^\s*date\s*:/i.test(l.str)) { labelField(l, 'dateField'); return; }
    if (/^\s*to\s*:/i.test(l.str)) { labelField(l, 'companyField'); return; }

    const size = sizeOf(l);
    const para = [l];
    for (let j = idx + 1; j < free.length; j++) {
      const n = free[j];
      const prev = para[para.length - 1];
      if (used.has(n) || /^\s*(date|to)\s*:/i.test(n.str)) break;
      if (Math.abs(sizeOf(n) - size) > 0.6 || Math.abs(n.minX - l.minX) > 6 || prev.y - n.y > size * 1.9) break;
      para.push(n);
    }
    para.forEach((p) => used.add(p));

    const maxX = Math.max(...para.map((p) => p.maxX));
    const text = para.map((p) => p.str.replace(/\s+/g, ' ').trim()).join(' ');
    const heading = size >= 16;
    const lineH = size * 1.3;
    elements.push({
      id: nextId(heading ? 'heading' : 'text'), type: heading ? 'heading' : 'text', ...base,
      bold: heading, fontSize: Math.round(size), text,
      x: toPxX(l.minX), y: toPxY(l.y + size),
      width: Math.min(CANVAS_WIDTH_PX - toPxX(l.minX), (maxX - l.minX) * sx * 1.05 + 8),
      height: Math.ceil((para.length * lineH + 4) * sy),
    });
  });

  return elements.map((el) => ({
    ...el,
    x: Math.max(0, Math.round(el.x)),
    y: Math.max(0, Math.round(el.y)),
    width: Math.round(el.width),
    height: Math.round(el.height),
  }));
}

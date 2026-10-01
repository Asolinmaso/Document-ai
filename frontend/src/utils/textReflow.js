import { rgb, setCharacterSpacing } from 'pdf-lib';

/**
 * Replaces pieces of text in a PDF page by re-typesetting the line (or paragraph) they sit in.
 *
 * A replacement value is rarely as wide as the placeholder it replaces, so patching it into the old
 * slot either collides with the words that follow or leaves a hole. Instead the whole line is
 * erased and set again in the template's own font, size, colour and letter-spacing, justified to
 * the paragraph's margins when the original line was. When the words no longer fit the line, the
 * rest of the paragraph is re-wrapped. The font size is never changed.
 *
 * Coordinates are PDF points, origin bottom-left.
 */

export const fontSizeOf = (item) => Math.abs(item.transform[3]) || item.height || 12;

// A justified line may widen its word gaps by this many spaces before the paragraph is re-wrapped instead.
const MAX_STRETCH = 1.2;
const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 1, g: 1, b: 1 };

/** Lines as found on the page are split where a wide gap shows two unrelated blocks (e.g. two table cells). */
export const segmentLines = (lines) => {
  const out = [];
  lines.forEach((line) => {
    let seg = [];
    const flush = () => {
      if (!seg.length) return;
      out.push({
        y: line.y,
        page: line.page,
        items: seg,
        base: seg[0].transform[5],
        str: seg.map((i) => i.str).join(' '),
        minX: seg[0].transform[4],
        maxX: Math.max(...seg.map((i) => i.transform[4] + i.width)),
        height: Math.max(...seg.map((i) => fontSizeOf(i))),
      });
      seg = [];
    };
    line.items.forEach((item) => {
      const prev = seg[seg.length - 1];
      if (prev && item.transform[4] - (prev.transform[4] + prev.width) > Math.max(24, fontSizeOf(item) * 2.2)) flush();
      seg.push(item);
    });
    flush();
  });
  return out.sort((a, b) => b.y - a.y || a.minX - b.minX);
};

/**
 * The page text as one character array (lines top to bottom). Text items of a line are separated by a
 * blank; `glue` marks separators where the two items really touch (e.g. "xx" + "%"), so they stay one word.
 */
export const buildStream = (lines) => {
  const chars = [];
  lines.forEach((line, li) => {
    line.items.forEach((item, idx) => {
      if (idx > 0) {
        const prev = line.items[idx - 1];
        const gap = item.transform[4] - (prev.transform[4] + prev.width);
        const glue = gap < fontSizeOf(item) * 0.12 && !/\s$/.test(prev.str) && !/^\s/.test(item.str);
        chars.push({ ch: ' ', item: null, line: li, glue });
      }
      for (let k = 0; k < item.str.length; k++) chars.push({ ch: item.str[k], item, line: li });
    });
    chars.push({ ch: '\n', item: null, line: li });
  });
  return chars;
};

/** Runs the replacement patterns over the stream. Returns non-overlapping edits [{ s, e, text }] in page order. */
export const findEdits = (chars, replacements) => {
  if (!chars.length || !replacements.length) return [];
  const stream = chars.map((c) => c.ch).join('');
  const taken = new Uint8Array(chars.length);
  const edits = [];
  replacements.forEach(({ re, group, text }) => {
    const rx = new RegExp(re.source, re.flags.includes('d') ? re.flags : `${re.flags}d`);
    let m;
    while ((m = rx.exec(stream)) !== null) {
      if (m[0].length === 0) { rx.lastIndex++; continue; }
      let s = m.index;
      let e = m.index + m[0].length;
      if (group) {
        if (!m.indices?.[group]) continue;
        [s, e] = m.indices[group];
      }
      while (s < e && (!chars[s].item || /\s/.test(chars[s].ch))) s++;
      while (e > s && (!chars[e - 1].item || /\s/.test(chars[e - 1].ch))) e--;
      if (s >= e) continue;
      let free = true;
      for (let i = s; i < e; i++) if (taken[i]) { free = false; break; }
      if (!free) continue;
      taken.fill(1, s, e);
      edits.push({ s, e, text });
    }
  });
  return edits.sort((a, b) => a.s - b.s);
};

/* ── paragraph structure ──────────────────────────────────────────────── */

/** Lines stacked directly above/below `L` that share a key (left edge or centre), size and line pitch. */
const columnChain = (lines, L, keyOf, tol) => {
  const col = lines
    .filter((l) => Math.abs(keyOf(l) - keyOf(L)) <= tol && Math.abs(l.height - L.height) <= 0.6)
    .sort((a, b) => b.y - a.y);
  const at = col.indexOf(L);
  const maxGap = L.height * 2.1;
  let pitch = null;
  const linked = (upper, lower) => {
    const gap = upper.base - lower.base;
    if (gap <= 1 || gap > maxGap) return false;
    return pitch === null || Math.abs(gap - pitch) <= 1.5;
  };
  let lo = at;
  let hi = at;
  while (hi + 1 < col.length && linked(col[hi], col[hi + 1])) { pitch ??= col[hi].base - col[hi + 1].base; hi++; }
  while (lo > 0 && linked(col[lo - 1], col[lo])) { pitch ??= col[lo - 1].base - col[lo].base; lo--; }
  return { chain: col.slice(lo, hi + 1), pitch: pitch ?? L.height * 1.375 };
};

/** The paragraph (or centred block, e.g. a table cell) a line belongs to. `lines` are top to bottom. */
const groupOf = (lines, L) => {
  const leftCol = columnChain(lines, L, (l) => l.minX, 3);
  if (leftCol.chain.length < 2) {
    const centre = (l) => (l.minX + l.maxX) / 2;
    const mid = columnChain(lines, L, centre, 1.5);
    if (mid.chain.length > 1) {
      return { mode: 'center', lines: mid.chain, pitch: mid.pitch, centre: centre(L), width: Math.max(...mid.chain.map((l) => l.maxX - l.minX)) };
    }
  }
  const { chain, pitch } = leftCol;
  const left = Math.min(...chain.map((l) => l.minX));
  const right = Math.max(...chain.map((l) => l.maxX));
  const tol = Math.max(10, (right - left) * 0.03);
  const isFull = (l) => l.maxX >= right - tol;
  // Two or more lines ending on the same right edge: the text is justified, and a short line ends a paragraph.
  const justified = chain.filter((l) => l.maxX >= right - 1.5).length >= 2;
  let group = chain;
  if (justified) {
    const at = chain.indexOf(L);
    let lo = at;
    let hi = at;
    while (lo > 0 && isFull(chain[lo - 1])) lo--;
    while (hi < chain.length - 1 && isFull(chain[hi])) hi++;
    group = chain.slice(lo, hi + 1);
  }
  return { mode: 'left', lines: group, pitch, left, right, justified };
};

/* ── typesetting ──────────────────────────────────────────────────────── */

const colorKey = (c) => `${Math.round(c.r * 31)},${Math.round(c.g * 31)},${Math.round(c.b * 31)}`;

/**
 * @param page   pdf-lib page
 * @param lines  segmented lines of the page (top to bottom) — the array `chars` was built from
 * @param ctx    { font(family, bold, italic), safe(text, font), value: { family, bold, italic, color }, defaultColor,
 *                 bannerY, banner, warnings }
 */
export function applyEdits(page, lines, chars, edits, ctx) {
  if (!edits.length) return;

  // [start, end) of every line in the character stream
  const lineRange = lines.map(() => null);
  chars.forEach((c, i) => {
    if (lineRange[c.line]) lineRange[c.line][1] = i + 1;
    else lineRange[c.line] = [i, i + 1];
  });
  const lineIndex = new Map(lines.map((l, i) => [l, i]));

  // group the edits into blocks: one per paragraph, covering every line an edit touches
  const groups = new Map();
  const groupFor = (L) => {
    if (!groups.has(L)) {
      const g = groupOf(lines, L);
      g.lines.forEach((l) => { if (!groups.has(l)) groups.set(l, g); });
      groups.set(L, g);
    }
    return groups.get(L);
  };
  const blocks = new Map();
  edits.forEach((ed) => {
    const first = lines[chars[ed.s].line];
    const lastLine = lines[chars[ed.e - 1].line];
    const g = groupFor(first);
    if (!g.lines.includes(lastLine)) {
      // the value spans lines outside the detected paragraph: take them in
      for (let li = chars[ed.s].line; li <= chars[ed.e - 1].line; li++) if (!g.lines.includes(lines[li]) && Math.abs(lines[li].minX - lastLine.minX) < 3) g.lines.push(lines[li]);
      if (!g.lines.includes(lastLine)) g.lines.push(lastLine);
      g.lines.sort((a, b) => b.y - a.y);
    }
    const ia = g.lines.indexOf(first);
    const ib = g.lines.indexOf(lastLine);
    const block = blocks.get(g) || { g, i0: ia, i1: ib, edits: [] };
    block.i0 = Math.min(block.i0, ia);
    block.i1 = Math.max(block.i1, ib);
    block.edits.push(ed);
    blocks.set(g, block);
  });

  const erasures = [];
  const drawings = [];
  blocks.forEach((block) => {
    try {
      planBlock(block, { lines, chars, lineRange, lineIndex, ctx, erasures, drawings });
    } catch (err) {
      console.error('Could not re-typeset a paragraph:', err);
    }
  });

  erasures.forEach(({ x, y, width, height, color }) => page.drawRectangle({ x, y, width, height, color: rgb(color.r, color.g, color.b) }));
  drawings.forEach(({ tracking, runs }) => {
    page.pushOperators(setCharacterSpacing(tracking));
    runs.forEach(({ text, x, y, size, font, color }) => page.drawText(text, { x, y, size, font, color: rgb(color.r, color.g, color.b) }));
    page.pushOperators(setCharacterSpacing(0));
  });
}

function planBlock(block, env) {
  const { lines, chars, lineRange, lineIndex, ctx, erasures, drawings } = env;
  const { g } = block;
  const lastIdx = g.lines.length - 1;
  let { i0, i1 } = block;
  const editAt = new Map(block.edits.map((ed) => [ed.s, ed]));

  // the typeface of the paragraph (ignoring symbol fonts we cannot reproduce)
  const tally = new Map();
  g.lines.forEach((l) => l.items.forEach((i) => { if (i.family && i.family !== 'other') tally.set(i.family, (tally.get(i.family) || 0) + i.str.length); }));
  const family = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'helvetica';
  const size = g.lines[i0].height;
  const fontOf = (item) => ctx.font(!item.family || item.family === 'other' ? family : item.family, item.bold, item.italic);

  // leading items in a symbol font (bullets, arrows) stay where they are
  const fixed = new Set();
  const startX = new Map();
  g.lines.forEach((l) => {
    let k = 0;
    while (k < l.items.length - 1 && l.items[k].family === 'other') { fixed.add(l.items[k]); k++; }
    startX.set(l, l.items[k].transform[4]);
  });

  // letter-spacing of the paragraph: the smallest per-character surplus over the font's natural width
  let tracking = Infinity;
  g.lines.forEach((l) => l.items.forEach((i) => {
    if (fixed.has(i) || i.str.trim().length < 3) return;
    const f = fontOf(i);
    const t = (i.width - f.widthOfTextAtSize(ctx.safe(i.str, f), fontSizeOf(i))) / i.str.length;
    if (t < tracking) tracking = t;
  }));
  tracking = Number.isFinite(tracking) ? Math.min(Math.max(tracking, 0), size * 0.08) : 0;

  const spaceW = ctx.font(family, false, false).widthOfTextAtSize(' ', size) + tracking;
  const segWidth = (seg) => seg.font.widthOfTextAtSize(seg.text, seg.size) + tracking * seg.text.length;
  const measure = (word) => { word.w = word.segs.reduce((sum, seg) => sum + segWidth(seg), 0); return word; };

  const valueFont = ctx.font(ctx.value.family === 'auto' ? family : ctx.value.family, ctx.value.bold, ctx.value.italic);

  const collect = (a, b) => {
    const words = [];
    let cur = null;
    let skipUntil = -1;
    const end = () => { if (cur && cur.segs.length) words.push(cur); cur = null; };
    const push = (text, style, custom) => {
      if (!cur) cur = { segs: [], custom: false };
      if (custom) cur.custom = true;
      const lastSeg = cur.segs[cur.segs.length - 1];
      if (lastSeg && lastSeg.font === style.font && lastSeg.size === style.size && lastSeg.custom === Boolean(custom) && (custom || colorKey(lastSeg.color) === colorKey(style.color))) lastSeg.text += text;
      else cur.segs.push({ ...style, text, custom: Boolean(custom) });
    };
    for (let li = a; li <= b; li++) {
      const [from, to] = lineRange[lineIndex.get(g.lines[li])];
      for (let i = Math.max(from, skipUntil); i < to; i++) {
        const c = chars[i];
        const ed = editAt.get(i);
        if (ed) {
          const style = { font: valueFont, size: fontSizeOf(c.item), color: null };
          ctx.safe(ed.text, valueFont).split(/\s+/).filter(Boolean).forEach((w, k) => { if (k > 0) end(); push(w, style, true); });
          skipUntil = ed.e;
          i = ed.e - 1;
          continue;
        }
        if (!c.item) { if (c.ch === '\n' || !c.glue) end(); continue; }
        if (fixed.has(c.item)) { end(); continue; }
        if (/\s/.test(c.ch)) { end(); continue; }
        const f = fontOf(c.item);
        push(ctx.safe(c.ch, f), { font: f, size: fontSizeOf(c.item), color: c.item.color || BLACK }, false);
      }
      if (skipUntil <= to) end(); // a value that continues on the next line keeps its word open
    }
    end();

    // filled-in values take the colour of the text around them unless the user picked one
    const colours = new Map();
    words.forEach((w) => w.segs.forEach((s) => {
      if (s.custom) return;
      const k = colorKey(s.color);
      const entry = colours.get(k) || { color: s.color, n: 0 };
      entry.n += s.text.length;
      colours.set(k, entry);
    }));
    const around = [...colours.values()].sort((x, y) => y.n - x.n)[0]?.color;
    const valueColor = ctx.value.color || around || ctx.defaultColor;
    words.forEach((w) => { w.segs.forEach((s) => { if (s.custom) s.color = valueColor; }); measure(w); });
    return words;
  };

  const rowWidth = (a, r) => {
    if (g.mode === 'center') return Math.max(g.width * 1.2, g.width + 24);
    const line = g.lines[a + r];
    return g.right - (line ? startX.get(line) : g.left);
  };
  const natural = (row) => row.reduce((sum, w) => sum + w.w, 0) + spaceW * (row.length - 1);
  const wrap = (words, a) => {
    const rows = [[]];
    let used = 0;
    words.forEach((word) => {
      const row = rows[rows.length - 1];
      const add = (row.length ? spaceW : 0) + word.w;
      if (row.length && used + add > rowWidth(a, rows.length - 1) + 0.75) { rows.push([word]); used = word.w; } else { row.push(word); used += add; }
    });
    return rows;
  };

  let words = collect(i0, i1);
  let rows = wrap(words, i0);
  const fitsInPlace = () => rows.length === i1 - i0 + 1 && (
    g.mode === 'center' || !g.justified
    // a justified line must still fill its measure without stretching the word gaps too far
    || rows.every((row, r) => i0 + r === lastIdx || natural(row) + (row.length - 1) * spaceW * MAX_STRETCH >= rowWidth(i0, r))
  );
  if (!fitsInPlace() && i1 < lastIdx) {
    // the words no longer fill the same lines: re-wrap the rest of the paragraph
    i1 = lastIdx;
    words = collect(i0, i1);
    rows = wrap(words, i0);
  }

  // room for extra lines below the paragraph (one line pitch is always kept clear above the next block)
  const bottom = g.lines[lastIdx];
  const spanL = g.mode === 'center' ? g.centre - g.width / 2 : g.left;
  const spanR = g.mode === 'center' ? g.centre + g.width / 2 : g.right;
  const below = lines.filter((l) => l.base < bottom.base - 1 && l.maxX > spanL && l.minX < spanR).sort((x, y) => y.base - x.base)[0];
  const gap = below ? bottom.base - below.base : g.pitch * 2;
  const spare = i1 === lastIdx ? Math.max(0, Math.floor(gap / g.pitch + 0.05) - 1) : 0;
  const maxRows = i1 - i0 + 1 + spare;

  let shortened = false;
  while (rows.length > maxRows) {
    // still too long: cut the filled-in value (last word first) rather than shrinking the text
    const customAt = words.reduce((acc, w, i) => (w.custom ? [...acc, i] : acc), []);
    if (!customAt.length) break;
    const lastAt = customAt[customAt.length - 1];
    const seg = words[lastAt].segs.find((s) => s.custom);
    const bare = seg.text.replace(/\.{3}$/, '');
    if (customAt.length > 1) {
      words.splice(lastAt, 1);
      const prevSeg = words[customAt[customAt.length - 2]].segs.find((s) => s.custom);
      prevSeg.text = `${prevSeg.text.replace(/\.{3}$/, '')}...`;
      measure(words[customAt[customAt.length - 2]]);
    } else if (bare.length > 4) {
      seg.text = `${bare.slice(0, Math.max(3, bare.length - 3))}...`;
      measure(words[lastAt]);
    } else break;
    shortened = true;
    rows = wrap(words, i0);
  }
  if (shortened) ctx.warnings.add('A value was too long for its place in the template and was shortened.');

  for (let li = i0; li <= Math.min(i1, lastIdx); li++) {
    const line = g.lines[li];
    const bg = line.y > ctx.bannerY ? ctx.banner : WHITE;
    line.items.forEach((item) => {
      if (fixed.has(item)) return;
      const s = fontSizeOf(item);
      const y = item.transform[5] - s * 0.28;
      const height = s * 1.22;
      // `item.bg` describes what lies behind the text (e.g. a watermark), so the patch does not show
      if (item.bg && line.y <= ctx.bannerY) item.bg.forEach(({ x0, x1, color }) => erasures.push({ x: x0, y, width: x1 - x0, height, color }));
      else erasures.push({ x: item.transform[4] - 0.75, y, width: item.width + 1.5, height, color: bg });
    });
  }

  const runs = [];
  rows.forEach((row, r) => {
    const line = g.lines[i0 + r];
    const y = line ? line.base : bottom.base - (i0 + r - lastIdx) * g.pitch;
    const nat = natural(row);
    let x;
    let gapW = spaceW;
    if (g.mode === 'center') {
      x = g.centre - nat / 2;
    } else {
      x = line ? startX.get(line) : g.left;
      const paragraphEnd = i1 === lastIdx && r === rows.length - 1;
      if (g.justified && !paragraphEnd && row.length > 1) {
        gapW = Math.min(spaceW * 3, Math.max(spaceW * 0.7, spaceW + (rowWidth(i0, r) - nat) / (row.length - 1)));
      }
    }
    row.forEach((word) => {
      word.segs.forEach((seg) => {
        if (seg.text) runs.push({ text: seg.text, x, y, size: seg.size, font: seg.font, color: seg.color });
        x += segWidth(seg);
      });
      x += gapW;
    });
  });
  drawings.push({ tracking, runs });
}

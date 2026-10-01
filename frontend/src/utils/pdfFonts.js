import { StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * Fonts used when text is written into a quotation PDF.
 *
 * Replaced text has to look like the text around it, so the template's own typeface is embedded
 * whenever we ship it (Montserrat, served from /public/fonts). Anything else falls back to the
 * PDF standard fonts.
 */

const CUSTOM_FONT_FILES = {
  montserrat: {
    regular: 'Montserrat-Regular.ttf',
    bold: 'Montserrat-Bold.ttf',
    italic: 'Montserrat-Italic.ttf',
    boldItalic: 'Montserrat-BoldItalic.ttf',
  },
};

const STANDARD_FONT_SETS = {
  helvetica: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, italic: StandardFonts.HelveticaOblique, boldItalic: StandardFonts.HelveticaBoldOblique },
  times: { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold, italic: StandardFonts.TimesRomanItalic, boldItalic: StandardFonts.TimesRomanBoldItalic },
};

export const variantOf = (bold, italic) => (bold && italic ? 'boldItalic' : bold ? 'bold' : italic ? 'italic' : 'regular');

/** 'montserrat' | 'times' | 'helvetica' | 'other' (a face we cannot reproduce, e.g. a symbol font) */
export const familyKeyOf = (name) => {
  const n = String(name || '').toLowerCase();
  if (n.includes('montserrat')) return 'montserrat';
  if (/times|tinos|liberation ?serif/.test(n)) return 'times';
  if (/helvetica|arial|arimo|liberation ?sans/.test(n)) return 'helvetica';
  return 'other';
};

/** "ABCDEF+Montserrat-BoldItalic" -> { family: 'montserrat', bold: true, italic: true } */
export const describeFontName = (rawName) => {
  const name = String(rawName || '').replace(/^[A-Z]{6}\+/, '');
  return {
    family: familyKeyOf(name),
    bold: /bold|black|heavy|semibold|demi/i.test(name),
    italic: /italic|oblique/i.test(name),
  };
};

const fontBytesCache = new Map();

/** Fetches a bundled font file once per session (served from the app's /fonts folder). */
export const loadFontFile = (file) => {
  if (!fontBytesCache.has(file)) {
    const base = import.meta.env?.BASE_URL || '/';
    const request = fetch(`${base}fonts/${file}`).then((res) => {
      if (!res.ok) throw new Error(`Font ${file} could not be loaded (${res.status}).`);
      return res.arrayBuffer();
    });
    request.catch(() => fontBytesCache.delete(file)); // allow a retry on the next fill
    fontBytesCache.set(file, request);
  }
  return fontBytesCache.get(file);
};

/**
 * Embeds every font in `wanted` (objects like { family, bold, italic }) and returns a synchronous
 * lookup `font(family, bold, italic)`.
 */
export async function createFontBook(pdfDoc, wanted, { loader = loadFontFile, warnings } = {}) {
  pdfDoc.registerFontkit(fontkit);
  const fonts = new Map();
  const keyOf = (family, bold, italic) => `${family}|${variantOf(bold, italic)}`;

  const embedStandard = (family, variant) => {
    const set = STANDARD_FONT_SETS[family] || STANDARD_FONT_SETS.helvetica;
    return pdfDoc.embedFont(set[variant]);
  };

  const requests = new Map([[keyOf('helvetica', false, false), { family: 'helvetica', bold: false, italic: false }]]);
  for (const w of wanted) requests.set(keyOf(w.family, w.bold, w.italic), w);

  for (const [key, { family, bold, italic }] of requests) {
    const variant = variantOf(bold, italic);
    try {
      if (CUSTOM_FONT_FILES[family]) {
        fonts.set(key, await pdfDoc.embedFont(await loader(CUSTOM_FONT_FILES[family][variant]), { subset: true }));
      } else {
        fonts.set(key, await embedStandard(family, variant));
      }
    } catch (err) {
      console.error(`Could not embed ${key}:`, err);
      warnings?.add('The template font could not be loaded, so a standard font was used for the filled-in text.');
      fonts.set(key, await embedStandard('helvetica', variant));
    }
  }

  return (family, bold = false, italic = false) =>
    fonts.get(keyOf(family, bold, italic))
    || fonts.get(keyOf(family, bold, false))
    || fonts.get(keyOf(family, false, false))
    || fonts.get(keyOf('helvetica', false, false));
}

const CHAR_FALLBACK = {
  '₹': 'Rs. ', '–': '-', '—': '-', '−': '-', '‑': '-', '…': '...',
  ' ': ' ', ' ': ' ', '​': '', '×': 'x', '→': '->', '⟶': '->',
};

/**
 * Returns `safe(text, font)`: the text with every character the font cannot draw replaced by a close
 * equivalent (or "?"), so drawing never throws on an unsupported glyph.
 */
export const makeSafeText = (warnings, unsupported) => {
  const sets = new Map();
  const charsetOf = (font) => {
    if (!sets.has(font)) {
      let set = null;
      try { set = new Set(font.getCharacterSet()); } catch { /* unknown font type: assume it can draw everything */ }
      sets.set(font, set);
    }
    return sets.get(font);
  };
  const put = (ch, supported) => {
    if (!supported || supported.has(ch.codePointAt(0))) return ch;
    if (CHAR_FALLBACK[ch] !== undefined) {
      if (ch === '₹') warnings.add('₹ is printed as "Rs." (the PDF font has no rupee sign).');
      return [...CHAR_FALLBACK[ch]].map((c) => (supported.has(c.codePointAt(0)) ? c : '')).join('');
    }
    unsupported.add(ch);
    return '?';
  };
  return (text, font) => {
    const supported = charsetOf(font);
    let out = '';
    for (const ch of String(text ?? '').replace(/[\r\n\t]+/g, ' ')) out += put(ch, supported);
    return out;
  };
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { ArrowLeft, Bold, Italic, MousePointerClick, RotateCcw, Check } from 'lucide-react';
import PdfPage from './PdfPage';
import { analyzeTemplate, editTemplateText, listTemplateBlocks } from '../../utils/quotationEngine';
import { restoreTemplate } from '../../utils/templateRestore';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PAGE_W = 794; // A4 at 96 PPI, same canvas size as the quotation editor
const PAGE_H = 1123;

const toBytes = (dataUrl) => Uint8Array.from(atob(dataUrl.split(',')[1] || dataUrl), (c) => c.charCodeAt(0));
const toDataUrl = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return `data:application/pdf;base64,${btoa(binary)}`;
};

/* ── styled runs <-> the contentEditable box ─────────────────────────── */

const escapeHtml = (text) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const cssColor = (c) => `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;

const runsToHtml = (runs) => runs.map((run) => {
  const style = [`font-weight:${run.bold ? 700 : 400}`, `font-style:${run.italic ? 'italic' : 'normal'}`];
  if (run.color) style.push(`color:${cssColor(run.color)}`);
  const colorAttr = run.color ? ` data-color="${run.color.r},${run.color.g},${run.color.b}"` : '';
  return `<span style="${style.join(';')}"${colorAttr}>${escapeHtml(run.text)}</span>`;
}).join('');

/** Reads the edited box back into runs. Bold / italic come from the tags and inline styles the browser writes. */
const htmlToRuns = (root) => {
  const runs = [];
  const walk = (node, style) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue.replace(/ /g, ' ').replace(/[\r\n\t]+/g, ' ');
      if (text) runs.push({ ...style, text });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const next = { ...style };
    const tag = node.tagName;
    if (tag === 'B' || tag === 'STRONG') next.bold = true;
    if (tag === 'I' || tag === 'EM') next.italic = true;
    const weight = node.style?.fontWeight;
    if (weight) next.bold = weight === 'bold' || Number(weight) >= 600;
    const slant = node.style?.fontStyle;
    if (slant) next.italic = slant === 'italic' || slant === 'oblique';
    if (node.dataset?.color) {
      const [r, g, b] = node.dataset.color.split(',').map(Number);
      next.color = { r, g, b };
    }
    if ((tag === 'BR' || tag === 'DIV' || tag === 'P') && runs.length) runs.push({ ...style, text: ' ' });
    node.childNodes.forEach((child) => walk(child, next));
  };
  walk(root, { bold: false, italic: false, color: null });

  // merge neighbours with the same style, collapse repeated blanks, trim the ends
  const merged = [];
  runs.forEach((run) => {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italic === run.italic && JSON.stringify(last.color) === JSON.stringify(run.color)) last.text += run.text;
    else merged.push({ ...run });
  });
  merged.forEach((run, i) => {
    run.text = run.text.replace(/\s{2,}/g, ' ');
    if (i > 0 && /\s$/.test(merged[i - 1].text)) run.text = run.text.replace(/^\s+/, '');
  });
  if (merged.length) {
    merged[0].text = merged[0].text.replace(/^\s+/, '');
    merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, '');
  }
  return merged.filter((run) => run.text);
};

const sameRuns = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plainText = (runs) => runs.map((r) => r.text).join('');

/* ── editing panel ───────────────────────────────────────────────────── */

const toolButton = { background: 'white', border: '1px solid #D1D5DB', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#374151' };

// Mounted with `key={block.id}`, so the box always starts from the selected block's current text.
const BlockEditor = ({ block, runs, isEdited, onApply, onReset, onClose }) => {
  const boxRef = useRef(null);

  useEffect(() => {
    if (!boxRef.current) return;
    boxRef.current.innerHTML = runsToHtml(runs);
    boxRef.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const format = (command) => (e) => {
    e.preventDefault(); // keep the selection in the box
    document.execCommand(command);
  };

  const apply = () => onApply(htmlToRuns(boxRef.current));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#111827' }}>Edit text</h3>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Page {block.page}</span>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button type="button" title="Bold" aria-label="Bold" onMouseDown={format('bold')} style={toolButton}><Bold size={15} /></button>
        <button type="button" title="Italic" aria-label="Italic" onMouseDown={format('italic')} style={toolButton}><Italic size={15} /></button>
      </div>

      <div
        ref={boxRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Text of the selected block"
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (e.metaKey || e.ctrlKey) apply(); }
          if (e.key === 'Escape') onClose();
        }}
        onPaste={(e) => {
          // plain text only: pasted formatting would not match the template
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
        }}
        style={{ minHeight: '140px', maxHeight: '340px', overflowY: 'auto', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #5D1CC9', outline: 'none', fontSize: '14px', lineHeight: 1.6, color: '#111827', background: 'white', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      />

      <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
        The text keeps the template&apos;s font, size and alignment and re-wraps inside its own space.
        Placeholders such as <strong>xx%</strong>, <strong>XXmonth</strong> or <strong>XXXX[Company Name]</strong> are
        filled in automatically for each quotation — keep them where the value should appear.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" onClick={apply} style={{ background: '#5D1CC9', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Check size={14} /> Apply
        </button>
        {isEdited && (
          <button type="button" onClick={onReset} style={{ background: 'white', color: '#4B5563', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={14} /> Original text
          </button>
        )}
        <button type="button" onClick={onClose} style={{ background: 'white', color: '#4B5563', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

/* ── main view ───────────────────────────────────────────────────────── */

/**
 * Edits the wording of an existing PDF template in place: the real pages are shown, every paragraph,
 * heading and table cell can be clicked and rewritten, and the design (logo, banner, layout, fonts) is
 * left untouched. Changes are stored as data next to the untouched template (`templateEdits`) and are
 * applied whenever a quotation is generated.
 */
const TemplateTextEditorView = ({ doc, onBack, onSave, showToast }) => {
  const [base, setBase] = useState(null); // data URL of the untouched template
  const [analysis, setAnalysis] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [edits, setEdits] = useState(() => doc?.templateEdits || {});
  const [selectedId, setSelectedId] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const initialEdits = useRef(JSON.stringify(doc?.templateEdits || {}));

  // 1. the untouched template (documents saved by older versions only have the filled file)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let source = doc?.templateFile;
        if (!source) {
          if (!doc?.file) throw new Error('This document has no file.');
          const restored = await restoreTemplate(toBytes(doc.file));
          source = restored.changed ? toDataUrl(restored.bytes) : doc.file;
        }
        const result = await analyzeTemplate(pdfjsLib, toBytes(source), { allColours: true });
        if (cancelled) return;
        setBase(source);
        setAnalysis(result);
      } catch (err) {
        console.error('Could not open the template for editing:', err);
        if (!cancelled) setLoadError('This template could not be opened for editing.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocks = useMemo(() => (analysis ? listTemplateBlocks(analysis) : []), [analysis]);
  const blockById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  // 2. the pages as they look with the current changes
  const runId = useRef(0);
  useEffect(() => {
    if (!base || !analysis) return;
    const myRun = ++runId.current;
    (async () => {
      try {
        let bytes = toBytes(base);
        let notes = [];
        if (Object.keys(edits).length) {
          const result = await editTemplateText(bytes, analysis, edits);
          bytes = result.bytes;
          notes = result.warnings;
        }
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (myRun !== runId.current) return; // a newer change superseded this run
        setPdfDoc(pdf);
        setWarnings(notes);
      } catch (err) {
        console.error('Could not render the edited template:', err);
        if (myRun === runId.current) showToast?.('Could not apply that change.', 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, analysis, edits]);

  const applyBlock = useCallback((id, runs) => {
    const original = blockById.get(id)?.runs || [];
    setEdits((prev) => {
      const next = { ...prev };
      if (sameRuns(runs, original)) delete next[id];
      else next[id] = runs;
      return next;
    });
    setSelectedId(null);
  }, [blockById]);

  const resetBlock = useCallback((id) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedId(null);
  }, []);

  const changedCount = Object.keys(edits).length;
  const dirty = JSON.stringify(edits) !== initialEdits.current;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onSave({
        templateEdits: changedCount ? edits : null,
        // binds the changes to the exact template they were made on
        ...(doc.templateFile ? {} : { templateFile: base }),
      });
    } catch (err) {
      console.error('Failed to save the template changes:', err);
      showToast?.('Failed to save. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty && !window.confirm('Leave without saving your changes to the template?')) return;
    onBack();
  };

  const selected = selectedId ? blockById.get(selectedId) : null;
  const pages = analysis ? analysis.pageSizes : [];

  return (
    <div style={{ padding: '24px 32px', background: '#FFFFFF', minHeight: '100%', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>
        Quotation &gt; Edit Template &gt; {doc?.name || 'Untitled'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleBack} aria-label="Back" style={{ background: '#5D1CC9', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', boxShadow: '0 2px 4px rgba(93, 28, 201, 0.2)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Edit Template</h2>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0 0' }}>Click any text on the page to change its wording. The design stays as it is.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {changedCount > 0 && (
            <button type="button" onClick={() => { setEdits({}); setSelectedId(null); }} style={{ background: 'white', border: '1.5px solid #E5E7EB', color: '#4B5563', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              Discard all changes
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={!dirty || saving} style={{ background: '#5D1CC9', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: !dirty || saving ? 'default' : 'pointer', opacity: !dirty || saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        {/* side panel */}
        <div style={{ width: '340px', flexShrink: 0, position: 'sticky', top: '16px' }}>
          <div style={{ background: 'white', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
            {selected ? (
              <BlockEditor
                key={selected.id}
                block={selected}
                runs={edits[selected.id] || selected.runs}
                isEdited={Boolean(edits[selected.id])}
                onApply={(runs) => applyBlock(selected.id, runs)}
                onReset={() => resetBlock(selected.id)}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: '12px 4px' }}>
                <MousePointerClick size={28} style={{ color: '#5D1CC9', marginBottom: '10px' }} />
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 6px 0' }}>Select text to edit</p>
                <p style={{ fontSize: '12px', lineHeight: 1.6, margin: 0 }}>
                  Hover over the page and click a paragraph, heading or table cell. Edit it here, then choose Apply to see it on the page.
                </p>
              </div>
            )}
          </div>

          {changedCount > 0 && (
            <div style={{ marginTop: '14px', fontSize: '12px', color: '#4B5563' }}>
              <strong>{changedCount}</strong> block{changedCount === 1 ? '' : 's'} changed
              <ul style={{ listStyle: 'none', margin: '8px 0 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Object.keys(edits).filter((id) => blockById.has(id)).map((id) => (
                  <li key={id}>
                    <button type="button" onClick={() => setSelectedId(id)} style={{ width: '100%', textAlign: 'left', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '6px 8px', fontSize: '11px', color: '#92400E', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      p.{blockById.get(id).page} · {plainText(edits[id]) || '(removed)'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div role="alert" style={{ marginTop: '14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#991B1B', lineHeight: 1.5 }}>
              {warnings.map((w) => <div key={w}>{w}</div>)}
            </div>
          )}
        </div>

        {/* pages */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#F9FAFB', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB', overflowX: 'auto' }}>
          {loadError ? (
            <p style={{ color: '#B91C1C', fontSize: '14px', padding: '60px 0' }}>{loadError}</p>
          ) : !pdfDoc || !analysis ? (
            <p style={{ color: '#9CA3AF', fontSize: '14px', padding: '60px 0' }}>Preparing the template…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {pages.map((size, p) => {
                const kx = PAGE_W / size.width;
                const ky = PAGE_H / size.height;
                return (
                  <div key={p} style={{ width: PAGE_W, height: PAGE_H, position: 'relative', background: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', flexShrink: 0 }}>
                    <PdfPage pdfDoc={pdfDoc} pageNum={p + 1} width={PAGE_W} height={PAGE_H} />
                    {blocks.filter((b) => b.page === p + 1).map((b) => {
                      const isSelected = b.id === selectedId;
                      const isEdited = Boolean(edits[b.id]);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`tpl-block${isSelected ? ' is-selected' : ''}${isEdited ? ' is-edited' : ''}`}
                          title="Click to edit this text"
                          aria-label={`Edit: ${plainText(edits[b.id] || b.runs).slice(0, 60)}`}
                          onClick={() => setSelectedId(b.id)}
                          style={{
                            left: (b.box.x0 - size.x) * kx - 4,
                            top: (size.y + size.height - b.box.yTop) * ky - 3,
                            width: (b.box.x1 - b.box.x0) * kx + 8,
                            height: (b.box.yTop - b.box.yBottom) * ky + 6,
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateTextEditorView;

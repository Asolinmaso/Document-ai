import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { analyzeTemplate, fillQuotation } from '../../utils/quotationEngine';
import { restoreTemplate } from '../../utils/templateRestore';
import { downloadPdf, statusMeta } from '../../utils/docs';
import { sendMail } from '../../services/dataService';
import ConfirmDialog from '../ConfirmDialog';
import QuotationSendModal from './QuotationSendModal';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link,
  Type,
  Trash2,
  Edit,
  CheckCircle2
} from 'lucide-react';

const EMPTY_POSITION_FORM = { role: '', positions: '', qualifications: '', package: '' };

const PdfPage = memo(({ pdfDoc, pageNum, width, height }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!pdfDoc) return;
    let renderTask = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const viewport = page.getViewport({ scale: 1.0 });
        const scaleX = (width * dpr) / viewport.width;
        const scaleY = (height * dpr) / viewport.height;
        const transform = [scaleX, 0, 0, scaleY, 0, 0];

        context.clearRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
          transform: transform
        });
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException' && err.message !== 'Rendering cancelled, closed or replaced') {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum, width, height]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
});

// Isolated so that typing in the "Edit Data" fields (parent state) never has to reconcile the
// PDF canvas / iframe subtree. It only re-renders when the document actually changes: on mode
// toggle, or ~300ms after the user stops typing (once the debounced fill finishes).
const DocumentCanvas = memo(({ fileData, previewPdfData, isPreviewMode, pdfDoc, numPages }) => (
  <div style={{ flex: isPreviewMode ? '0 1 auto' : 1, display: 'flex', justifyContent: 'center', background: '#F9FAFB', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
    {fileData ? (
      <div style={{
        width: '210mm',
        height: '297mm',
        background: 'white',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        position: 'relative',
        overflowY: isPreviewMode ? 'hidden' : 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {isPreviewMode ? (
          <iframe
            src={previewPdfData || fileData}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Uploaded PDF Preview"
          />
        ) : (
          pdfDoc ? (
            Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
              <div key={pageNum} style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                <PdfPage
                  pdfDoc={pdfDoc}
                  pageNum={pageNum}
                  width={794}
                  height={1123}
                />
              </div>
            ))
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
              <p>Loading document pages...</p>
            </div>
          )
        )}
      </div>
    ) : (
      <div style={{
        width: '210mm',
        height: '297mm',
        background: 'white',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9CA3AF'
      }}>
        <p>No document uploaded</p>
      </div>
    )}
  </div>
));

// Format-only controls: none of these depend on the text fields the user is typing into,
// so memoizing keeps them from re-rendering on every keystroke elsewhere in the form.
const EditorToolbar = memo(({ fontFamily, setFontFamily, fontSize, setFontSize, isBold, setIsBold, isItalic, setIsItalic, isUnderline, setIsUnderline, textColor, setTextColor }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 20px',
    border: '1.5px solid #E5E7EB',
    borderRadius: '12px',
    marginBottom: '24px',
    color: '#4B5563'
  }}>
    <div style={{ paddingRight: '16px', borderRight: '1px solid #E5E7EB' }}>
      <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '13px', fontWeight: '500', outline: 'none', color: '#4B5563', cursor: 'pointer' }}>
        <option value="auto">Template font</option>
        <option value="Helvetica">Helvetica (Sans)</option>
        <option value="Times New Roman">Times New Roman (Serif)</option>
      </select>
    </div>
    <div style={{ paddingRight: '16px', borderRight: '1px solid #E5E7EB' }}>
      <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ border: 'none', background: 'transparent', fontSize: '13px', fontWeight: '500', outline: 'none', color: '#4B5563', cursor: 'pointer' }}>
        {[10, 11, 12, 13, 14, 16, 18, 20, 24].map(size => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '16px', borderRight: '1px solid #E5E7EB' }}>
      <Bold size={16} cursor="pointer" color={isBold ? '#5D1CC9' : '#4B5563'} onClick={() => setIsBold(!isBold)} />
      <Italic size={16} cursor="pointer" color={isItalic ? '#5D1CC9' : '#4B5563'} onClick={() => setIsItalic(!isItalic)} />
      <Underline size={16} cursor="pointer" color={isUnderline ? '#5D1CC9' : '#4B5563'} onClick={() => setIsUnderline(!isUnderline)} />
      <Strikethrough size={16} cursor="pointer" color="#4B5563" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', position: 'relative' }}>
        <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer' }} title="Change Text Color" />
        <Type size={16} color={textColor !== '#111827' ? textColor : '#4B5563'} />
        <ChevronDown size={12} color="#4B5563" />
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '16px', borderRight: '1px solid #E5E7EB' }}>
      <AlignLeft size={16} />
      <AlignCenter size={16} />
      <AlignRight size={16} />
      <AlignJustify size={16} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <List size={16} />
      <ListOrdered size={16} />
      <Link size={16} />
      <Type size={16} />
    </div>
  </div>
));

const fieldInputStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', outline: 'none' };

// Fully local form state: typing a role/package/etc. only re-renders this small component,
// never the positions list or the document canvas. Mount a fresh instance (via `key` at the
// call site) whenever the edit target changes, so its local state resets to the right values.
const PositionForm = memo(({ initialValues, isEditing, onSubmit, onCancel }) => {
  const [form, setForm] = useState(initialValues);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = () => {
    if (!form.role.trim()) return;
    onSubmit(form);
    if (!isEditing) setForm(EMPTY_POSITION_FORM);
  };

  return (
    <div style={{
      background: isEditing ? '#EEF2FF' : '#F5F3FF',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '8px',
      border: isEditing ? '1px solid #C7D2FE' : '1px solid #EDE9FE'
    }}>
      <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#4C1D95', margin: '0 0 12px 0' }}>
        {isEditing ? 'Edit Position :' : 'Position Details :'}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Role :</label>
          <input type="text" value={form.role} onChange={update('role')} style={fieldInputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>No. Of Positions :</label>
          <input type="text" value={form.positions} onChange={update('positions')} style={fieldInputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Qualifications :</label>
          <input type="text" value={form.qualifications} onChange={update('qualifications')} style={fieldInputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Package :</label>
          <input type="text" value={form.package} onChange={update('package')} style={fieldInputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignSelf: 'flex-end' }}>
          {isEditing && (
            <button
              onClick={onCancel}
              style={{ background: 'white', color: '#4B5563', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={submit}
            style={{ background: '#5D1CC9', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
          >
            {isEditing ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
});

const PositionsList = memo(({ positions, editingId, onEdit, onDelete }) => {
  if (positions.length === 0) return null;
  return (
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#5D1CC9', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Added Positions</h4>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 52px 64px 72px 52px',
        gap: '6px',
        padding: '4px 8px',
        fontSize: '10px',
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        <span>Role</span>
        <span>Pos</span>
        <span>Qual</span>
        <span>Pkg</span>
        <span></span>
      </div>

      {positions.map((pos, idx) => (
        <div key={pos.id} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 52px 64px 72px 52px',
          gap: '6px',
          alignItems: 'center',
          padding: '7px 8px',
          borderRadius: '8px',
          background: pos.id === editingId ? '#EEF2FF' : (idx % 2 === 0 ? '#F9FAFB' : 'transparent'),
          fontSize: '12px'
        }}>
          <span style={{ fontWeight: '600', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.role || '—'}</span>
          <span style={{ color: '#374151' }}>{pos.positions || '—'}</span>
          <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.qualifications || '—'}</span>
          <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.package || '—'}</span>
          <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
            <button
              className="icon-btn"
              onClick={() => onEdit(pos)}
              title="Edit Position"
              aria-label="Edit Position"
              style={{ padding: '3px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: pos.id === editingId ? '#5D1CC9' : '#9CA3AF' }}
            >
              <Edit size={13} />
            </button>
            <button
              className="icon-btn"
              onClick={() => onDelete(pos.id)}
              title="Delete Position"
              aria-label="Delete Position"
              style={{ padding: '3px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});

const uint8ArrayToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
};

const sameValues = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const escapeHtml = (text) => String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const EditorView = ({ onBack, doc, logo, onSaveQuotation, onCreateQuotation, onEditTemplate, onDeleteDoc, showToast, initialPreview = false }) => {
  const fileName = doc ? doc.name : "Recruitment Quotation";
  const docType = doc ? doc.type : "Quotation";
  const fileData = doc ? doc.file : null;
  const isDraft = doc?.status === 'draft';

  // Saved per document, so one quotation's client / positions never leak into the next one
  const storageKey = `editorState:${doc?.id ?? 'default'}`;

  // Two places hold the form's values: this browser's autosave (covers edits that were never saved) and the
  // document record on the server (covers drafts opened from another browser/device). The newer one wins.
  const [savedState] = useState(() => {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(storageKey)); } catch { /* unreadable or blocked */ }
    const server = doc?.quotationData && Object.keys(doc.quotationData).length ? doc.quotationData : null;
    const serverTs = Date.parse(doc?.updatedAt) || 0;
    if (local && (!server || (local._ts || 0) >= serverTs)) return local;
    return server || local || {};
  });

  const loadInitialState = (key, defaultVal) => (savedState[key] !== undefined ? savedState[key] : defaultVal);

  // Dates are written the way the template design shows them: "19 June, 2026"
  const formatDate = (d) => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'long' })}, ${d.getFullYear()}`;
  // YYYY-MM-DD in local time for the date picker (toISOString would give the UTC day)
  const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const getTodayFormatted = () => formatDate(new Date());
  const getTodayISO = () => toISODate(new Date());

  // Convert YYYY-MM-DD → "19 June, 2026"
  const formatDateForTemplate = (isoDate) => (isoDate ? formatDate(new Date(`${isoDate}T00:00:00`)) : '');

  // Convert a typed date back to YYYY-MM-DD for the picker
  const parseFormattedDate = (formatted) => {
    const d = new Date(String(formatted).replace(/,/g, ', '));
    return Number.isNaN(d.getTime()) ? getTodayISO() : toISODate(d);
  };

  const [date, setDate] = useState(() => loadInitialState('date', getTodayFormatted()));
  const [dateISO, setDateISO] = useState(() => {
    const saved = loadInitialState('date', '');
    return saved ? parseFormattedDate(saved) : getTodayISO();
  });
  // "To" (header recipient) and "Company Name" (every other company placeholder) are independent fields.
  // Quotations saved before the split only have companyName, which then seeds both.
  const [recipient, setRecipient] = useState(() => loadInitialState('recipient', loadInitialState('companyName', '')));
  const [companyName, setCompanyName] = useState(() => loadInitialState('companyName', ''));
  const [totalRequirements, setTotalRequirements] = useState(() => loadInitialState('totalRequirements', ''));
  const [replacementGuarantee, setReplacementGuarantee] = useState(() => loadInitialState('replacementGuarantee', ''));
  const [serviceFee, setServiceFee] = useState(() => loadInitialState('serviceFee', ''));
  const [advanceAmount, setAdvanceAmount] = useState(() => loadInitialState('advanceAmount', ''));
  // The document's own name — editable independently of the PDF fill pipeline below, so typing
  // here never waits on (or gets interrupted by) the debounced preview regeneration.
  const [docName, setDocName] = useState(() => loadInitialState('docName', fileName));
  const [sendOpen, setSendOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [positions, setPositions] = useState(() => loadInitialState('positions', []));
  const [editingPositionId, setEditingPositionId] = useState(null);

  // Toolbar State
  // Typeface of the filled-in values: 'auto' follows the template's own font
  const [valueFont, setValueFont] = useState(() => loadInitialState('valueFont', 'auto'));
  const [fontSize, setFontSize] = useState(() => loadInitialState('fontSize', 16));
  const [isBold, setIsBold] = useState(() => loadInitialState('isBold', true));
  const [isItalic, setIsItalic] = useState(() => loadInitialState('isItalic', false));
  const [isUnderline, setIsUnderline] = useState(() => loadInitialState('isUnderline', false));
  const [align, setAlign] = useState(() => loadInitialState('align', 'left'));
  const [listType, setListType] = useState(() => loadInitialState('listType', 'none'));
  const [textColor, setTextColor] = useState(() => loadInitialState('textColor', '#111827'));

  // The form fields are typed into freely; the document only changes when the user applies them (Update Data /
  // Save / Finalize / Send). `applied` is the snapshot the preview and downloads are generated from.
  const snapshot = () => ({ date, recipient, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, positions, valueFont, isBold, isItalic, textColor });
  const [applied, setApplied] = useState(snapshot);

  // Persisted to localStorage ~400ms after the user stops changing anything, instead of on
  // every keystroke — avoids a synchronous JSON.stringify + write on each character typed.
  const autosaveBaseline = React.useRef(null); // initial values: untouched state must not be stamped "newer than the server"
  useEffect(() => {
    const values = { date: date || undefined, recipient, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, docName, positions, valueFont, fontSize, isBold, isItalic, isUnderline, align, listType, textColor };
    const serialized = JSON.stringify(values);
    if (autosaveBaseline.current === null) autosaveBaseline.current = serialized;
    if (serialized === autosaveBaseline.current) return undefined;
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify({ ...values, _ts: Date.now() })); } catch { /* storage full or blocked */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [storageKey, date, recipient, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, docName, positions, valueFont, fontSize, isBold, isItalic, isUnderline, align, listType, textColor]);

  // The quotation is always generated from the pristine template, never from an already filled PDF
  // (filling a filled file stacks text on top of the old text and repeats tables). Documents saved
  // before the template was stored separately only have the filled file, so it is restored once here.
  const [templateData, setTemplateData] = useState(() => doc?.templateFile || null);
  useEffect(() => {
    if (templateData || !fileData) return undefined;
    let cancelled = false;
    (async () => {
      let restored = fileData;
      try {
        const bytes = Uint8Array.from(atob(fileData.split(',')[1] || fileData), c => c.charCodeAt(0));
        const result = await restoreTemplate(bytes);
        if (result.changed) restored = `data:application/pdf;base64,${uint8ArrayToBase64(result.bytes)}`;
      } catch (err) {
        console.error('Could not restore the template from the saved file:', err);
      }
      if (!cancelled) setTemplateData(restored);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Template analysis: text lines, fonts, colours, table grid and banner colour are measured once per template
  const [analysis, setAnalysis] = useState(null);
  const [fillWarnings, setFillWarnings] = useState([]);

  useEffect(() => {
    if (!templateData) return;
    let cancelled = false;
    (async () => {
      try {
        const base64Data = templateData.split(',')[1] || templateData;
        const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const result = await analyzeTemplate(pdfjsLib, pdfBytes);
        if (cancelled) return;
        setAnalysis(result);
        if (result.extracted.date && !date) {
          setDate(result.extracted.date);
          setApplied((a) => ({ ...a, date: result.extracted.date }));
        }
        // a fresh template with a client already in it seeds both fields once; after that they stay independent
        if (result.extracted.company && !recipient && !companyName) {
          setRecipient(result.extracted.company);
          setCompanyName(result.extracted.company);
          setApplied((a) => ({ ...a, recipient: result.extracted.company, companyName: result.extracted.company }));
        }
      } catch (err) {
        console.error('Template analysis failed:', err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateData]);

  // Preview State
  const [previewPdfData, setPreviewPdfData] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(initialPreview);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    const docData = previewPdfData || fileData;
    if (!docData) return;

    let isCurrent = true;
    const loadPdf = async () => {
      try {
        const base64Data = docData.split(',')[1] || docData;
        const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        const pdf = await loadingTask.promise;
        if (isCurrent) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
        }
      } catch (err) {
        console.error("Error loading PDF for canvas rendering:", err);
      }
    };
    loadPdf();

    return () => {
      isCurrent = false;
    };
  }, [previewPdfData, fileData]);


  // Live PDF generation (debounced; stale runs are discarded). This is the one genuinely
  // expensive step (PDF-lib fill + re-render), so it — not the input fields — is what waits
  // for a pause in typing.
  const runId = React.useRef(0);

  const generatePreview = async (forDownload = false, values = applied) => {
    if (!templateData || !analysis) return null;
    const myRun = ++runId.current;

    try {
      const base64Data = templateData.split(',')[1] || templateData;
      const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const { bytes, warnings } = await fillQuotation(
        pdfBytes,
        analysis,
        values,
        values
      );
      if (myRun !== runId.current && !forDownload) return null; // a newer edit superseded this run

      const dataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(bytes)}`;
      if (!forDownload) {
        setPreviewPdfData(dataUrl);
        setFillWarnings(warnings);
      }
      return dataUrl;
    } catch (err) {
      console.error('Error generating PDF preview:', err);
      return null;
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  // Downloads exactly what's shown: re-runs the fill against the latest field values so the
  // PDF file that lands on disk always matches the on-screen preview, instead of printing the whole app UI.
  const handleDownloadPdf = async () => {
    if (!fileData || isDownloading) return;
    setIsDownloading(true);
    try {
      const dataUrl = analysis ? await generatePreview(true) : fileData;
      const source = dataUrl || previewPdfData || fileData;
      if (!source) return;

      downloadPdf(source, docName || fileName);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!templateData || !analysis) return;
    const timer = setTimeout(() => { generatePreview(); }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, applied]);

  const [isSaving, setIsSaving] = useState(false);

  const buildQuotationData = () => ({ date, recipient, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, positions, valueFont, isBold, isItalic, textColor });

  // Persists the form to the server (not just localStorage) so drafts/history survive across browsers and devices.
  // Drafts and sent copies are their own records: saving one from a template/final document creates a new
  // document and leaves the original untouched, instead of turning the template itself into a draft.
  const persist = async (targetStatus, prebuiltFile = null) => {
    const snap = snapshot();
    setApplied((prev) => (sameValues(prev, snap) ? prev : snap)); // an unchanged form does not re-render the document
    const dataUrl = prebuiltFile || (analysis ? await generatePreview(true, snap) : null);
    let name = docName.trim() || fileName;
    const payload = {
      status: targetStatus,
      quotationData: buildQuotationData(),
      ...(dataUrl ? { file: dataUrl } : {}),
      // stored once, so later fills always start from the untouched template
      ...(templateData && !doc.templateFile ? { templateFile: templateData } : {}),
    };
    const createsNew = !isDraft && (targetStatus === 'draft' || targetStatus === 'sent');
    if (createsNew) {
      if (name === doc.name && companyName.trim()) name = `${name} - ${companyName.trim()}`;
      const saved = await onCreateQuotation({
        ...payload,
        name,
        type: doc.type || 'Quotation',
        file: dataUrl || doc.file || '',
        ...(templateData ? { templateFile: templateData } : {}),
        ...(doc.templateElements ? { templateElements: doc.templateElements } : {}),
      });
      try { localStorage.removeItem(storageKey); } catch { /* storage blocked */ }
      return saved;
    }
    return onSaveQuotation(doc.id, { ...payload, name });
  };

  const lastSaved = React.useRef(null); // what the last successful save contained
  const runSave = async (targetStatus, successMessage) => {
    if (!doc || !onSaveQuotation) {
      showToast?.('Nothing to save yet — upload or open a document first.', 'warning');
      return;
    }
    if (isSaving) return;
    // Clicking again without changing anything neither saves nor re-renders the document
    const signature = JSON.stringify({ targetStatus, id: doc.id, name: docName, data: buildQuotationData() });
    if (signature === lastSaved.current) {
      showToast?.('Already up to date.', 'info');
      return;
    }
    setIsSaving(true);
    try {
      await persist(targetStatus);
      lastSaved.current = signature;
      showToast?.(successMessage, 'success');
    } catch (err) {
      console.error('Failed to save quotation:', err);
      showToast?.('Failed to save. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => runSave('draft', 'Saved as draft.');
  const handleFinalize = () => runSave('active', 'Quotation finalized.');
  // "Update Data" keeps whatever status the document already has
  const handleUpdateData = () => runSave(doc?.status || 'active', isDraft ? 'Draft saved.' : 'Quotation updated.');

  const handleSend = async ({ to, subject, message }) => {
    setIsSending(true);
    try {
      const snap = snapshot();
      setApplied((prev) => (sameValues(prev, snap) ? prev : snap));
      const dataUrl = analysis ? await generatePreview(true, snap) : fileData;
      if (!dataUrl) throw new Error('There is no document to send.');
      const result = await sendMail({
        to,
        subject,
        body: escapeHtml(message).replace(/\n/g, '<br>'),
        attachments: [{ name: `${(docName || fileName).trim() || 'quotation'}.pdf`, content: dataUrl }],
      });
      try { await persist('sent', dataUrl); } catch (err) { console.error('Sent, but could not update status:', err); }
      setSendOpen(false);
      showToast?.(result?.previewUrl ? `Sent to ${to} (test mailbox — no SMTP configured).` : `Quotation sent to ${to}.`, 'success');
    } catch (err) {
      showToast?.(err.message || 'Failed to send the quotation.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Leaving for the template editor: store the current values first so they are still here on return.
  const handleEditTemplate = async () => {
    if (!doc || !onEditTemplate) return;
    try { await onSaveQuotation?.(doc.id, { quotationData: buildQuotationData() }); } catch { /* local autosave still has them */ }
    onEditTemplate(doc);
  };

  // A shareable link re-opens this exact document (the app is a single-page state machine, so
  // the link carries the document id as a query param that App/Dashboard read on load).
  const handleCopyLink = useCallback(async () => {
    if (!doc) {
      showToast?.('Nothing to link to yet.', 'warning');
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}?docId=${doc.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast?.('Link copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy link:', err);
      showToast?.('Could not copy the link. Please copy it manually.', 'error');
    }
  }, [doc, showToast]);

  // Position CRUD: stable identities so PositionsList (memoized) doesn't re-render just
  // because EditorView re-rendered for an unrelated reason.
  const handleSubmitPosition = useCallback((values) => {
    setEditingPositionId((currentId) => {
      setPositions((prev) => (
        currentId
          ? prev.map((p) => (p.id === currentId ? { ...values, id: currentId } : p))
          : [...prev, { ...values, id: Date.now() }]
      ));
      return null;
    });
  }, []);

  const handleEditPosition = useCallback((pos) => setEditingPositionId(pos.id), []);
  const handleCancelEditPosition = useCallback(() => setEditingPositionId(null), []);
  const handleDeletePosition = useCallback((id) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
    setEditingPositionId((cur) => (cur === id ? null : cur));
  }, []);

  const editingPosition = useMemo(
    () => positions.find((p) => p.id === editingPositionId) || null,
    [positions, editingPositionId]
  );
  const positionFormInitialValues = editingPosition
    ? { role: editingPosition.role, positions: editingPosition.positions, qualifications: editingPosition.qualifications, package: editingPosition.package }
    : EMPTY_POSITION_FORM;

  return (
    <div style={{
      padding: '24px 32px',
      background: '#FFFFFF',
      minHeight: '100%',
      fontFamily: '"Inter", sans-serif'
    }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>
        Document &gt; {docType} &gt; {docType === 'Quotation' ? 'Recruitment Quotation' : fileName}
      </div>

      {/* Main Title Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{
            background: '#5D1CC9',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            boxShadow: '0 2px 4px rgba(93, 28, 201, 0.2)'
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>
          {docType === 'Quotation' ? 'Recruitment Quotation' : fileName}
        </h2>
      </div>

      {/* Name and Actions Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827', paddingBottom: '2px' }}>Name :</span>
          <input
            type="text"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="Document name"
            style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#111827',
              border: 'none',
              borderBottom: '1px solid #6B7280',
              paddingBottom: '2px',
              minWidth: '220px',
              outline: 'none',
              background: 'transparent'
            }}
          />
          {(isDraft || doc?.status === 'sent') && (
            <span style={{ background: statusMeta(doc.status).bg, color: statusMeta(doc.status).color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
              {statusMeta(doc.status).label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', position: 'relative', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {onEditTemplate && (
            <button onClick={handleEditTemplate} title="Open this template in the template editor" style={{
              background: 'white',
              border: '1.5px solid #E5E7EB',
              color: '#5D1CC9',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Edit size={14} /> Edit
            </button>
          )}
          <button onClick={() => setIsPreviewMode(!isPreviewMode)} style={{
            background: isPreviewMode ? '#5D1CC9' : 'white',
            border: isPreviewMode ? '1.5px solid #5D1CC9' : '1.5px solid #E5E7EB',
            color: isPreviewMode ? 'white' : '#5D1CC9',
            padding: '8px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            {isPreviewMode ? 'Edit Mode' : 'Preview'}
          </button>
          {isDraft && (
            <button onClick={handleFinalize} disabled={isSaving} style={{
              background: '#16A34A',
              border: '1.5px solid #16A34A',
              color: 'white',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isSaving ? 'default' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <CheckCircle2 size={14} /> Finalize
            </button>
          )}
          <button onClick={() => setShowMoreMenu(!showMoreMenu)} style={{
            background: 'white',
            border: '1.5px solid #E5E7EB',
            color: '#5D1CC9',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            More {showMoreMenu ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Floating Dropdown Menu */}
          {showMoreMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '8px',
              width: '180px',
              background: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 10
            }}>
              <div onClick={() => { setShowMoreMenu(false); handleDownloadPdf(); }} style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', color: isDownloading ? '#9CA3AF' : '#5D1CC9', fontWeight: '600', fontSize: '13px', cursor: isDownloading ? 'default' : 'pointer' }}>
                {isDownloading ? 'Preparing PDF…' : 'Download as PDF'}
              </div>
              <div onClick={() => { setShowMoreMenu(false); handleCopyLink(); }} style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', color: '#5D1CC9', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Copy Link
              </div>
              <div onClick={() => { setShowMoreMenu(false); handleSaveDraft(); }} style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', color: isSaving ? '#9CA3AF' : '#5D1CC9', fontWeight: '600', fontSize: '13px', cursor: isSaving ? 'default' : 'pointer' }}>
                {isSaving ? 'Saving…' : isDraft ? 'Save Draft' : 'Save As Draft'}
              </div>
              <div onClick={() => { setShowMoreMenu(false); setSendOpen(true); }} style={{ padding: '12px 16px', borderBottom: isDraft ? '1px solid #E5E7EB' : 'none', color: '#5D1CC9', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Send by Email
              </div>
              {isDraft && onDeleteDoc && (
                <div onClick={() => { setShowMoreMenu(false); setConfirmDelete(true); }} style={{ padding: '12px 16px', color: '#DC2626', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                  Delete Draft
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {!isPreviewMode && (
        <EditorToolbar
          fontFamily={valueFont} setFontFamily={setValueFont}
          fontSize={fontSize} setFontSize={setFontSize}
          isBold={isBold} setIsBold={setIsBold}
          isItalic={isItalic} setIsItalic={setIsItalic}
          isUnderline={isUnderline} setIsUnderline={setIsUnderline}
          textColor={textColor} setTextColor={setTextColor}
        />
      )}

      {/* Main Content Area */}
      <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', justifyContent: isPreviewMode ? 'center' : 'flex-start' }}>

        {/* Left Column: Edit Data */}
        {!isPreviewMode && (
          <div style={{ width: '320px', flexShrink: 0 }}>
            <div style={{
              background: 'white',
              border: '1.5px solid #E5E7EB',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#111827' }}>Edit Data</h3>
              </div>

              {fillWarnings.length > 0 && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
                  {fillWarnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Date :</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="date"
                      value={dateISO}
                      onChange={e => {
                        const iso = e.target.value;
                        setDateISO(iso);
                        setDate(formatDateForTemplate(iso));
                      }}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px', flex: 1 }}
                    />
                  </div>
                  <input
                    type="text"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    placeholder="e.g. 19 June, 2026"
                    title="Auto-filled from date picker above. You can also edit manually."
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none', fontSize: '11px', color: '#5D1CC9', fontWeight: '600', background: '#F5F3FF' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="quotation-to" style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>To :</label>
                  <input
                    id="quotation-to"
                    type="text"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="Shown after “To :” in the header"
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="quotation-company" style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Company Name :</label>
                  <input
                    id="quotation-company"
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="Used for the company name in the quotation text"
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Total Position Requirements :</label>
                  <input type="text" value={totalRequirements} onChange={e => setTotalRequirements(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px' }} />
                </div>

                <PositionForm
                  key={editingPositionId || 'new'}
                  initialValues={positionFormInitialValues}
                  isEditing={!!editingPositionId}
                  onSubmit={handleSubmitPosition}
                  onCancel={handleCancelEditPosition}
                />

                <PositionsList
                  positions={positions}
                  editingId={editingPositionId}
                  onEdit={handleEditPosition}
                  onDelete={handleDeletePosition}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Service Fee % :</label>
                  <input
                    type="text"
                    value={serviceFee}
                    onChange={e => setServiceFee(e.target.value)}
                    placeholder="e.g. 8.33"
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Replacement Guarantee :</label>
                  <input
                    type="text"
                    value={replacementGuarantee}
                    onChange={e => setReplacementGuarantee(e.target.value)}
                    placeholder="e.g. 3 months"
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Advance Amount In Rs :</label>
                  <input
                    type="text"
                    value={advanceAmount}
                    onChange={e => setAdvanceAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px' }}
                  />
                </div>

                <button
                  onClick={handleUpdateData}
                  disabled={isSaving}
                  style={{
                    alignSelf: 'flex-end',
                    background: '#5D1CC9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSaving ? 'default' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    marginTop: '4px'
                  }}
                >
                  {isSaving ? 'Saving…' : isDraft ? 'Save Draft' : 'Update Data'}
                </button>
              </div>
            </div>
          </div>
        )}

        <DocumentCanvas
          fileData={fileData}
          previewPdfData={previewPdfData}
          isPreviewMode={isPreviewMode}
          pdfDoc={pdfDoc}
          numPages={numPages}
        />

      </div>

      {sendOpen && (
        <QuotationSendModal
          open
          defaultSubject={`Quotation${(companyName || recipient).trim() ? ` for ${(companyName || recipient).trim()}` : ''}`}
          sending={isSending}
          onSend={handleSend}
          onClose={() => setSendOpen(false)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this draft?"
        message={`"${docName || fileName}" will be permanently deleted. This can't be undone.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDeleteDoc(doc); }}
      />
    </div>
  );
};

export default EditorView;

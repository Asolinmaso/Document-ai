import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { analyzeTemplate, fillQuotation } from '../../utils/quotationEngine';
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
  Edit
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

const EditorView = ({ onBack, doc, logo, onSaveQuotation, showToast }) => {
  const fileName = doc ? doc.name : "Recruitment Quotation";
  const docType = doc ? doc.type : "Quotation";
  const fileData = doc ? doc.file : null;

  // Saved per document, so one quotation's client / positions never leak into the next one
  const storageKey = `editorState:${doc?.id ?? 'default'}`;

  const loadInitialState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[key] !== undefined) return parsed[key];
      }
    } catch (e) { }
    return defaultVal;
  };

  // Returns today's date as "JUNE 19,2026" to match template header format
  const getTodayFormatted = () => {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const day = now.getDate();
    const year = now.getFullYear();
    return `${month} ${day},${year}`;
  };

  // Returns today in YYYY-MM-DD for the date picker input
  const getTodayISO = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Convert YYYY-MM-DD → "JUNE 19,2026"
  const formatDateForTemplate = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T00:00:00');
    const month = d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month} ${day},${year}`;
  };

  // Convert formatted date back to YYYY-MM-DD for the picker
  const parseFormattedDate = (formatted) => {
    try {
      const d = new Date(formatted.replace(',', ' '));
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch (e) {}
    return getTodayISO();
  };

  const [date, setDate] = useState(() => loadInitialState('date', getTodayFormatted()));
  const [dateISO, setDateISO] = useState(() => {
    const saved = loadInitialState('date', '');
    return saved ? parseFormattedDate(saved) : getTodayISO();
  });
  const [companyName, setCompanyName] = useState(() => loadInitialState('companyName', ''));
  const [totalRequirements, setTotalRequirements] = useState(() => loadInitialState('totalRequirements', ''));
  const [replacementGuarantee, setReplacementGuarantee] = useState(() => loadInitialState('replacementGuarantee', ''));
  const [serviceFee, setServiceFee] = useState(() => loadInitialState('serviceFee', ''));
  const [advanceAmount, setAdvanceAmount] = useState(() => loadInitialState('advanceAmount', ''));
  // The document's own name — editable independently of the PDF fill pipeline below, so typing
  // here never waits on (or gets interrupted by) the debounced preview regeneration.
  const [docName, setDocName] = useState(() => loadInitialState('docName', fileName));
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [positions, setPositions] = useState(() => loadInitialState('positions', []));
  const [editingPositionId, setEditingPositionId] = useState(null);

  // Toolbar State
  const [fontFamily, setFontFamily] = useState(() => loadInitialState('fontFamily', 'Helvetica'));
  const [fontSize, setFontSize] = useState(() => loadInitialState('fontSize', 16));
  const [isBold, setIsBold] = useState(() => loadInitialState('isBold', true));
  const [isItalic, setIsItalic] = useState(() => loadInitialState('isItalic', false));
  const [isUnderline, setIsUnderline] = useState(() => loadInitialState('isUnderline', false));
  const [align, setAlign] = useState(() => loadInitialState('align', 'left'));
  const [listType, setListType] = useState(() => loadInitialState('listType', 'none'));
  const [textColor, setTextColor] = useState(() => loadInitialState('textColor', '#111827'));

  // Persisted to localStorage ~400ms after the user stops changing anything, instead of on
  // every keystroke — avoids a synchronous JSON.stringify + write on each character typed.
  useEffect(() => {
    const stateToSave = { date: date || undefined, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, docName, positions, fontFamily, fontSize, isBold, isItalic, isUnderline, align, listType, textColor };
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(stateToSave)); } catch { /* storage full or blocked */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [storageKey, date, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, docName, positions, fontFamily, fontSize, isBold, isItalic, isUnderline, align, listType, textColor]);

  // Template analysis: text lines, table grid and banner colour are measured once per uploaded PDF
  const [analysis, setAnalysis] = useState(null);
  const [fillWarnings, setFillWarnings] = useState([]);

  useEffect(() => {
    if (!fileData) return;
    let cancelled = false;
    (async () => {
      try {
        const base64Data = fileData.split(',')[1] || fileData;
        const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const result = await analyzeTemplate(pdfjsLib, pdfBytes);
        if (cancelled) return;
        setAnalysis(result);
        if (result.extracted.date && !date) setDate(result.extracted.date);
        if (result.extracted.company && !companyName) setCompanyName(result.extracted.company);
      } catch (err) {
        console.error('Template analysis failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [fileData]);

  // Preview State
  const [previewPdfData, setPreviewPdfData] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

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

  const uint8ArrayToBase64 = (bytes) => {
    let binary = '';
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return window.btoa(binary);
  };

  // Live PDF generation (debounced; stale runs are discarded). This is the one genuinely
  // expensive step (PDF-lib fill + re-render), so it — not the input fields — is what waits
  // for a pause in typing.
  const runId = React.useRef(0);

  const generatePreview = async (forDownload = false) => {
    if (!fileData || !analysis) return null;
    const myRun = ++runId.current;

    try {
      const base64Data = fileData.split(',')[1] || fileData;
      const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const { bytes, warnings } = await fillQuotation(
        pdfBytes,
        analysis,
        { date, companyName, totalRequirements, replacementGuarantee, serviceFee, positions },
        { fontFamily, isBold, isItalic, textColor }
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

      const base64Data = source.split(',')[1] || source;
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const safeName = (fileName || 'quotation').trim().replace(/[^a-z0-9\-_ ]+/gi, '').replace(/\s+/g, '_') || 'quotation';
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!fileData || !analysis) return;
    const timer = setTimeout(() => { generatePreview(); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, date, companyName, totalRequirements, replacementGuarantee, serviceFee, positions, textColor, fontFamily, isBold, isItalic]);

  const [isSaving, setIsSaving] = useState(false);

  // Persists the form's current values to the document record on the server (not just
  // localStorage), so drafts/history survive across browsers and devices.
  const handleSave = useCallback(async (status) => {
    if (!doc || !onSaveQuotation) {
      showToast?.('Nothing to save yet — upload or open a document first.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const dataUrl = analysis ? await generatePreview(true) : null;
      const quotationData = { date, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, positions, fontFamily, isBold, isItalic, textColor };
      await onSaveQuotation(doc.id, {
        name: docName,
        status,
        quotationData,
        ...(dataUrl ? { file: dataUrl } : {}),
      });
      showToast?.(status === 'draft' ? 'Saved as draft.' : 'Quotation updated.', 'success');
    } catch (err) {
      console.error('Failed to save quotation:', err);
      showToast?.('Failed to save. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, onSaveQuotation, showToast, analysis, date, companyName, totalRequirements, replacementGuarantee, serviceFee, advanceAmount, positions, fontFamily, isBold, isItalic, textColor, docName]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
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
        </div>
        <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
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
              <div onClick={() => { setShowMoreMenu(false); handleSave('draft'); }} style={{ padding: '12px 16px', color: isSaving ? '#9CA3AF' : '#5D1CC9', fontWeight: '600', fontSize: '13px', cursor: isSaving ? 'default' : 'pointer' }}>
                {isSaving ? 'Saving…' : 'Save As Draft'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {!isPreviewMode && (
        <EditorToolbar
          fontFamily={fontFamily} setFontFamily={setFontFamily}
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
                    placeholder="e.g. JUNE 19,2026"
                    title="Auto-filled from date picker above. You can also edit manually."
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none', fontSize: '11px', color: '#5D1CC9', fontWeight: '600', background: '#F5F3FF' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>To :</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Art Mount"
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
                  onClick={() => handleSave(doc?.status === 'draft' ? 'draft' : 'active')}
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
                  {isSaving ? 'Updating…' : 'Update Data'}
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
    </div>
  );
};

export default EditorView;

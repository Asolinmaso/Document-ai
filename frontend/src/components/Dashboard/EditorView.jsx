import React, { useState, useEffect } from 'react';
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

const PdfPage = ({ pdfDoc, pageNum, width, height }) => {
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
};

const EditorView = ({ onBack, doc, logo }) => {
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [positionForm, setPositionForm] = useState({
    role: '',
    positions: '',
    qualifications: '',
    package: ''
  });

  const [positions, setPositions] = useState(() => loadInitialState('positions', []));

  // Toolbar State
  const [fontFamily, setFontFamily] = useState(() => loadInitialState('fontFamily', 'Montserrat'));
  const [fontSize, setFontSize] = useState(() => loadInitialState('fontSize', 16));
  const [isBold, setIsBold] = useState(() => loadInitialState('isBold', true));
  const [isItalic, setIsItalic] = useState(() => loadInitialState('isItalic', false));
  const [isUnderline, setIsUnderline] = useState(() => loadInitialState('isUnderline', false));
  const [align, setAlign] = useState(() => loadInitialState('align', 'left'));
  const [listType, setListType] = useState(() => loadInitialState('listType', 'none'));
  const [textColor, setTextColor] = useState(() => loadInitialState('textColor', '#111827'));

  // Save to localStorage whenever important state changes
  // Note: we skip saving date if it's empty, so the auto-today default always applies on fresh open
  useEffect(() => {
    const stateToSave = { date: date || undefined, companyName, totalRequirements, replacementGuarantee, serviceFee, positions, fontFamily, fontSize, isBold, isItalic, isUnderline, align, listType, textColor };
    try { localStorage.setItem(storageKey, JSON.stringify(stateToSave)); } catch { /* storage full or blocked */ }
  }, [storageKey, date, companyName, totalRequirements, replacementGuarantee, serviceFee, positions, fontFamily, fontSize, isBold, isItalic, isUnderline, align, listType, textColor]);

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

  const generatePreview = async () => {
    if (!fileData || !analysis) return;
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
      if (myRun !== runId.current) return; // a newer edit superseded this run

      setPreviewPdfData(`data:application/pdf;base64,${uint8ArrayToBase64(bytes)}`);
      setFillWarnings(warnings);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
    }
  };

  // Live PDF generation (debounced; stale runs are discarded)
  const runId = React.useRef(0);
  useEffect(() => {
    if (!fileData || !analysis) return;
    const timer = setTimeout(() => { generatePreview(); }, 300);
    return () => clearTimeout(timer);
  }, [analysis, date, companyName, totalRequirements, replacementGuarantee, serviceFee, positions, textColor, fontFamily, isBold, isItalic]);

  const handleAddPosition = () => {
    if (positionForm.role) {
      setPositions([...positions, { ...positionForm, id: Date.now() }]);
      setPositionForm({ role: '', positions: '', qualifications: '', package: '' });
    }
  };

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
            background: '#6C2BD9',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            boxShadow: '0 2px 4px rgba(108, 43, 217, 0.2)'
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
          <span style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#6B7280',
            borderBottom: '1px solid #6B7280',
            paddingBottom: '2px',
            minWidth: '220px'
          }}>
            {fileName}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
          <button onClick={() => setIsPreviewMode(!isPreviewMode)} style={{
            background: isPreviewMode ? '#6C2BD9' : 'white',
            border: isPreviewMode ? '1.5px solid #6C2BD9' : '1.5px solid #E5E7EB',
            color: isPreviewMode ? 'white' : '#6C2BD9',
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
            color: '#6C2BD9',
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
              <div onClick={() => { window.print(); setShowMoreMenu(false); }} style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', color: '#6C2BD9', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Download as PDF
              </div>
              <div onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copied to clipboard!'); setShowMoreMenu(false); }} style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', color: '#6C2BD9', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Copy Link
              </div>
              <div onClick={() => { alert('Document saved as draft!'); setShowMoreMenu(false); }} style={{ padding: '12px 16px', color: '#6C2BD9', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Save As Draft
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {!isPreviewMode && (
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
              <option value="Montserrat">Montserrat</option>
              <option value="Inter">Inter</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
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
            <Bold size={16} cursor="pointer" color={isBold ? '#6C2BD9' : '#4B5563'} onClick={() => setIsBold(!isBold)} />
            <Italic size={16} cursor="pointer" color={isItalic ? '#6C2BD9' : '#4B5563'} onClick={() => setIsItalic(!isItalic)} />
            <Underline size={16} cursor="pointer" color={isUnderline ? '#6C2BD9' : '#4B5563'} onClick={() => setIsUnderline(!isUnderline)} />
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
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', outline: 'none', fontSize: '11px', color: '#6C2BD9', fontWeight: '600', background: '#F5F3FF' }}
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
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Service Fee Percentage (%) :</label>
                  <input
                    type="text"
                    value={serviceFee}
                    onChange={e => setServiceFee(e.target.value)}
                    placeholder="e.g. 8.33"
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px' }}
                  />
                </div>

                {/* Position Details Form */}
                <div style={{
                  background: '#F5F3FF',
                  borderRadius: '12px',
                  padding: '16px',
                  marginTop: '8px',
                  border: '1px solid #EDE9FE'
                }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#4C1D95', margin: '0 0 12px 0' }}>Position Details :</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Role :</label>
                      <input type="text" value={positionForm.role} onChange={e => setPositionForm({ ...positionForm, role: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>No. Of Positions :</label>
                      <input type="text" value={positionForm.positions} onChange={e => setPositionForm({ ...positionForm, positions: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Qualifications :</label>
                      <input type="text" value={positionForm.qualifications} onChange={e => setPositionForm({ ...positionForm, qualifications: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Package :</label>
                      <input type="text" value={positionForm.package} onChange={e => setPositionForm({ ...positionForm, package: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', outline: 'none' }} />
                    </div>
                    <button
                      onClick={handleAddPosition}
                      style={{
                        background: '#6C2BD9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginTop: '8px',
                        alignSelf: 'flex-end',
                        width: '80px'
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* List of Added Positions */}
                {positions.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#6C2BD9', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Added Positions</h4>

                    {/* Header Row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 52px 64px 72px 28px',
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
                        gridTemplateColumns: '1fr 52px 64px 72px 28px',
                        gap: '6px',
                        alignItems: 'center',
                        padding: '7px 8px',
                        borderRadius: '8px',
                        background: idx % 2 === 0 ? '#F9FAFB' : 'transparent',
                        fontSize: '12px'
                      }}>
                        <span style={{ fontWeight: '600', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.role || '—'}</span>
                        <span style={{ color: '#374151' }}>{pos.positions || '—'}</span>
                        <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.qualifications || '—'}</span>
                        <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.package || '—'}</span>
                        <button
                          onClick={() => setPositions(positions.filter(p => p.id !== pos.id))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px'
                          }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Middle Column: Document Canvas */}
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

        {/* Actions Menu moved to Header */}

      </div>
    </div>
  );
};

export default EditorView;

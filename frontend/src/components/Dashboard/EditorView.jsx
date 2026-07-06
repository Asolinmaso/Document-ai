import React, { useState, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
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

  const loadInitialState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem('editorState');
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
    localStorage.setItem('editorState', JSON.stringify(stateToSave));
  }, [date, companyName, totalRequirements, replacementGuarantee, serviceFee, positions, fontFamily, fontSize, isBold, isItalic, isUnderline, align, listType, textColor]);

  // Smart Multi-Page State
  const [elementsPos, setElementsPos] = useState({
    date: [{ page: 1, x: 530, y: 150 }],
    company: [{ page: 1, x: 530, y: 170 }],
    totalReq: [{ page: 1, x: 60, y: 420 }],
    table: [{ page: 1, x: 60, y: 460 }]
  });

  // Semantic AI Replace State
  const [detectedCompanyName, setDetectedCompanyName] = useState('');
  const [pdfLines, setPdfLines] = useState([]);
  const [dragInfo, setDragInfo] = useState({ id: null, offsetX: 0, offsetY: 0, canvasLeft: 0, canvasTop: 0 });

  // Smart Keyword Scanner: Auto-detect "Date" and "To" coordinates
  useEffect(() => {
    if (!fileData) return;

    const autoDetectFields = async () => {
      try {
        const base64Data = fileData.split(',')[1] || fileData;
        const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        let newDatePos = [];
        let newCompanyPos = [];
        let newTablePos = [];
        let newTotalReqPos = [];
        let extractedDate = null;
        let extractedCompany = null;

        const HTML_WIDTH = 794;
        const HTML_HEIGHT = 1123;

        let allItems = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();

          const viewport = page.getViewport({ scale: 1.0 });
          const scaleX = HTML_WIDTH / viewport.width;
          const scaleY = HTML_HEIGHT / viewport.height;

          const items = textContent.items.sort((a, b) => {
            if (Math.abs(a.transform[5] - b.transform[5]) > 5) return b.transform[5] - a.transform[5];
            return a.transform[4] - b.transform[4];
          }).map(item => ({ ...item, pageNum, scaleX, scaleY }));

          allItems = allItems.concat(items);

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.str) continue;
            const str = item.str.trim().toLowerCase();
            const tx = item.transform[4];
            const ty = item.transform[5];
            const itemX = tx * scaleX;
            const itemY = HTML_HEIGHT - (ty * scaleY) - (item.height * scaleY);

            if (str.includes('[date]') || str.includes('xxx_date')) {
              newDatePos.push({ page: pageNum, x: itemX, y: itemY });
            } else if (str.includes('date :') || str === 'date:') {
              newDatePos.push({ page: pageNum, x: itemX + (item.width * scaleX) + 15, y: itemY });
              if (i + 1 < items.length) {
                const nextItem = items[i + 1];
                if (Math.abs(nextItem.transform[5] - ty) < 10 && nextItem.transform[4] > tx && nextItem.str.trim()) {
                  const val = nextItem.str.trim();
                  if (!extractedDate && val !== 'xxx' && !val.includes('xxx')) extractedDate = val;
                }
              }
            }

            if (str.includes('[company]') || str.includes('xxx_company') || str === 'xxx') {
              newCompanyPos.push({ page: pageNum, x: itemX, y: itemY });
            } else if (str.includes('to :') || str === 'to:') {
              newCompanyPos.push({ page: pageNum, x: itemX + (item.width * scaleX) + 15, y: itemY });
              if (i + 1 < items.length) {
                const nextItem = items[i + 1];
                if (Math.abs(nextItem.transform[5] - ty) < 10 && nextItem.transform[4] > tx && nextItem.str.trim()) {
                  const val = nextItem.str.trim();
                  if (!extractedCompany && val !== 'xxx' && !val.includes('xxx')) extractedCompany = val;
                }
              }
            }

            if (str.includes('position requirements')) {
              newTablePos.push({ page: pageNum, x: itemX, y: itemY });
              newTotalReqPos.push({ page: pageNum, x: itemX, y: itemY - 40 });
            }
          }
        }

        // Build lines for robust text replacement
        let allLines = [];
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const pageItems = allItems.filter(i => i.pageNum === pageNum);
          const lines = [];
          pageItems.forEach(item => {
            if (!item.str.trim()) return;
            const ty = Math.round(item.transform[5]);
            const existingLine = lines.find(l => Math.abs(l.y - ty) < 5);
            if (existingLine) {
              existingLine.items.push(item);
              existingLine.items.sort((a, b) => a.transform[4] - b.transform[4]);
              // Reconstruct string by joining with spaces or just concatenating based on distance
              // To be safe, we join with spaces because PDFjs sometimes splits words.
              existingLine.str = existingLine.items.map(i => i.str).join(" ");
              // Update bounding box
              existingLine.minX = Math.min(existingLine.minX, item.transform[4]);
              existingLine.maxX = Math.max(existingLine.maxX, item.transform[4] + item.width);
              existingLine.height = Math.max(existingLine.height, item.height);
            } else {
              lines.push({
                y: ty,
                page: pageNum,
                items: [item],
                str: item.str,
                minX: item.transform[4],
                maxX: item.transform[4] + item.width,
                height: item.height
              });
            }
          });
          allLines = allLines.concat(lines);
        }

        setPdfLines(allLines);

        // Semantic AI Analysis to find Original Company Name
        let detectedOrg = "";
        for (let i = 0; i < allLines.length; i++) {
          const str = allLines[i].str;
          if (str.includes("services to ") && str.includes(" We appreciate")) {
            const match = str.match(/services to (.*?) We appreciate/);
            if (match && match[1]) {
              detectedOrg = match[1].trim();
              break;
            }
          } else if (str.includes("ABOUT ")) {
            const match = str.match(/ABOUT ([A-Z ]+)/);
            if (match && match[1]) {
              detectedOrg = match[1].trim();
              break;
            }
          }
        }

        if (detectedOrg && detectedOrg.length > 2) {
          setDetectedCompanyName(detectedOrg);
        }

        setElementsPos(prev => ({
          ...prev,
          date: newDatePos.length > 0 ? newDatePos : [{ page: 1, x: 530, y: 150 }],
          company: newCompanyPos.length > 0 ? newCompanyPos : [{ page: 1, x: 530, y: 170 }],
          table: newTablePos.length > 0 ? newTablePos : [{ page: 1, x: 60, y: 460 }],
          totalReq: newTotalReqPos.length > 0 ? newTotalReqPos : [{ page: 1, x: 60, y: 420 }]
        }));

        if (extractedDate && !date) setDate(extractedDate);
        if (extractedCompany && !companyName) setCompanyName(extractedCompany);
      } catch (err) {
        console.error("Smart Keyword Scanner Failed:", err);
      }
    };

    autoDetectFields();
  }, [fileData]);

  // Live PDF Generation trigger
  useEffect(() => {
    if (!fileData || !elementsPos.date || elementsPos.date.length === 0) return;
    const timer = setTimeout(() => {
      handlePreview();
    }, 300); // Reduced debounce to 300ms for near-instant rendering on canvas
    return () => clearTimeout(timer);
  }, [date, companyName, detectedCompanyName, totalRequirements, replacementGuarantee, serviceFee, positions, textColor, fontSize, fontFamily, elementsPos]);

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

  const handlePreview = async () => {
    if (!fileData) {
      alert("No document uploaded!");
      return;
    }

    try {
      const base64Data = fileData.split(',')[1] || fileData;
      const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const pdfDoc = await PDFDocument.load(pdfBytes);

      let selectedFont = StandardFonts.Helvetica;
      if (fontFamily === 'Times New Roman') {
        if (isBold && isItalic) selectedFont = StandardFonts.TimesRomanBoldItalic;
        else if (isBold) selectedFont = StandardFonts.TimesRomanBold;
        else if (isItalic) selectedFont = StandardFonts.TimesRomanItalic;
        else selectedFont = StandardFonts.TimesRoman;
      } else {
        if (isBold && isItalic) selectedFont = StandardFonts.HelveticaBoldOblique;
        else if (isBold) selectedFont = StandardFonts.HelveticaBold;
        else if (isItalic) selectedFont = StandardFonts.HelveticaOblique;
      }

      const helveticaFont = await pdfDoc.embedFont(selectedFont);
      const fallbackBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fallbackRegularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      const HTML_WIDTH = 794;
      const HTML_HEIGHT = 1123;

      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 } : { r: 1, g: 1, b: 1 };
      };
      const textColorRgb = hexToRgb(textColor);

      for (let pageNum = 1; pageNum <= pdfDoc.getPageCount(); pageNum++) {
        const page = pages[pageNum - 1];
        const { width, height } = page.getSize();
        const scaleX = width / HTML_WIDTH;
        const scaleY = height / HTML_HEIGHT;

        // Date and Company name are now handled automatically by the Semantic Find and Replace engine!
        const reqVal = parseInt(totalRequirements || '0', 10);
        const totalRowsCount = Math.max(positions.length, reqVal);
        const numDynamicRows = Math.max(0, totalRowsCount - 4);

        if (totalRowsCount > 0) {
          const tablePosArray = elementsPos.table.filter(p => p.page === pageNum);
          tablePosArray.forEach(tPos => {
            const noteLine = pdfLines.find(l => l.page === pageNum && l.str.toLowerCase().includes('note: the requirement'));
            let nextRowTopY = height - (tPos.y * scaleY) - 180 * scaleY; // fallback
            let baseBottomY = noteLine ? noteLine.y + 32 : nextRowTopY;

            if (noteLine) {
              if (numDynamicRows > 0) {
                page.drawRectangle({
                  x: noteLine.minX,
                  y: noteLine.y - 5,
                  width: noteLine.maxX - noteLine.minX + 20,
                  height: noteLine.height + 10,
                  color: rgb(1, 1, 1)
                });
              }
            }

            // --- Clean borderless row rendering (no box/line borders) ---
            const startX = 48 * scaleX;
            const rowHeightPDF = 35 * scaleY;

            for (let index = 0; index < totalRowsCount; index++) {
              const pos = positions[index] || { role: '', positions: '', qualifications: '', package: '' };

              let textY;

              if (index < 4) {
                // Fill existing pre-drawn template rows (each ~47.05 pts tall in PDF)
                textY = baseBottomY + (3.5 - index) * 47.05 - 4;
              } else {
                // Dynamically append new rows below row 4 — no border lines drawn
                const dynamicIndex = index - 4;
                const yPos = baseBottomY - dynamicIndex * rowHeightPDF;
                textY = yPos - 22 * scaleY;

                // Alternate very subtle background tint for even rows (no borders)
                if (dynamicIndex % 2 === 0) {
                  page.drawRectangle({
                    x: startX,
                    y: yPos - rowHeightPDF,
                    width: 698 * scaleX,
                    height: rowHeightPDF,
                    color: rgb(0.97, 0.97, 0.99),
                    opacity: 1
                  });
                }
              }

              // Serial number
              page.drawText(`${1 + index}`, {
                x: startX + 22 * scaleX,
                y: textY,
                size: 10 * scaleY,
                font: fallbackRegularFont,
                color: rgb(0.4, 0.4, 0.4)
              });

              // Only draw details if we have this position in our positions array
              if (index < positions.length) {
                const roleTxt = pos.role ? pos.role.substring(0, 30) : '';
                if (roleTxt.trim()) {
                  page.drawText(roleTxt, { x: startX + 70 * scaleX, y: textY, size: 10 * scaleY, font: fallbackBoldFont, color: rgb(0.07, 0.07, 0.15) });
                }

                const posTxt = pos.positions ? String(pos.positions) : '';
                if (posTxt.trim()) {
                  page.drawText(posTxt, { x: startX + 345 * scaleX, y: textY, size: 10 * scaleY, font: fallbackRegularFont, color: rgb(0.15, 0.15, 0.15) });
                }

                const qualTxt = pos.qualifications ? pos.qualifications.substring(0, 20) : '';
                if (qualTxt.trim()) {
                  page.drawText(qualTxt, { x: startX + 415 * scaleX, y: textY, size: 10 * scaleY, font: fallbackRegularFont, color: rgb(0.15, 0.15, 0.15) });
                }

                const pkgTxt = pos.package ? pos.package.substring(0, 20) : '';
                if (pkgTxt.trim()) {
                  page.drawText(pkgTxt, { x: startX + 560 * scaleX, y: textY, size: 10 * scaleY, font: fallbackRegularFont, color: rgb(0.15, 0.15, 0.15) });
                }
              }
            }

            // Shift Note line down if we added dynamic rows (no box drawn around it)
            if (noteLine && numDynamicRows > 0) {
              const shiftedNoteY = baseBottomY - numDynamicRows * 35 * scaleY;
              page.drawText(noteLine.str, {
                x: noteLine.minX,
                y: shiftedNoteY - 20,
                size: noteLine.height * 0.9,
                font: fallbackRegularFont,
                color: rgb(0, 0, 0)
              });
            }
          });
        }

        // --- Semantic Find and Replace ---
        // ONLY replace explicit placeholder codes in the document.
        // Do NOT replace the detected company name (e.g. "MABS") globally.
        const replacements = [];

        // ── DATE PLACEHOLDERS ──────────────────────────────────────────────────
        // Covers: xxx_date, XXX_DATE, [date], [DATE], date xxx, Date : XXXX, etc.
        if (date) {
          // Explicit placeholder codes the template author puts in the PDF
          replacements.push({ target: 'xxx_date', text: date });
          replacements.push({ target: 'XXX_DATE', text: date });
          replacements.push({ target: 'Xxx_date', text: date });
          replacements.push({ target: '[date]', text: date });
          replacements.push({ target: '[DATE]', text: date });
          replacements.push({ target: '{{date}}', text: date });
          replacements.push({ target: '{{DATE}}', text: date });
          // Legacy / other formats
          replacements.push({ target: 'date xxx', text: date });
          replacements.push({ target: 'DATE XXX', text: date });
          replacements.push({ target: 'Date : XXXX', text: `Date : ${date}` });
          replacements.push({ target: 'Date: XXXX', text: `Date: ${date}` });
          replacements.push({ target: 'DATE : XXXX', text: `DATE : ${date}` });
          replacements.push({ target: 'Date :XXXX', text: `Date :${date}` });
          replacements.push({ target: 'Date : xxx', text: `Date : ${date}` });
          replacements.push({ target: 'date : xxx', text: `Date : ${date}` });
        }

        // ── COMPANY NAME PLACEHOLDERS ──────────────────────────────────────────
        // Covers: xxx_company, XXX_COMPANY, [company], To : XXXX, etc.
        if (companyName) {
          // Explicit placeholder codes
          replacements.push({ target: 'xxx_company', text: companyName });
          replacements.push({ target: 'XXX_COMPANY', text: companyName });
          replacements.push({ target: 'Xxx_company', text: companyName });
          replacements.push({ target: '[company]', text: companyName });
          replacements.push({ target: '[COMPANY]', text: companyName });
          replacements.push({ target: '{{company}}', text: companyName });
          replacements.push({ target: '{{COMPANY}}', text: companyName });
          // To : field variants
          replacements.push({ target: 'To : XXXX', text: `To : ${companyName}` });
          replacements.push({ target: 'To: XXXX', text: `To: ${companyName}` });
          replacements.push({ target: 'TO : XXXX', text: `To : ${companyName}` });
          replacements.push({ target: 'To : xxx', text: `To : ${companyName}` });
          replacements.push({ target: 'to : xxx', text: `To : ${companyName}` });
          replacements.push({ target: 'company xxx', text: companyName });
          replacements.push({ target: 'COMPANY XXX', text: companyName });
          // Named bracket variants
          replacements.push({ target: 'XXXX[Company Name]', text: companyName });
          replacements.push({ target: '[Company Name]', text: companyName });
          replacements.push({ target: "XXXX[COMPANY'S NAME]", text: companyName });
          replacements.push({ target: "[COMPANY'S NAME]", text: companyName });
          replacements.push({ target: "XXXX[Company's Name]", text: companyName });
          replacements.push({ target: "[Company's Name]", text: companyName });
        }

        // ── REPLACEMENT GUARANTEE PLACEHOLDERS ────────────────────────────────
        if (replacementGuarantee) {
          let guaranteeText = replacementGuarantee.trim();
          // Auto-append "month"/"months" if only a number is provided
          if (/^\d+$/.test(guaranteeText)) {
            const num = parseInt(guaranteeText, 10);
            guaranteeText = `${num} ${num === 1 ? 'month' : 'months'}`;
          }
          replacements.push({ target: 'XXmonth', text: guaranteeText });
          replacements.push({ target: 'XX month', text: guaranteeText });
          replacements.push({ target: 'XXmonths', text: guaranteeText });
          replacements.push({ target: 'XX months', text: guaranteeText });
          replacements.push({ target: 'xxx_months', text: guaranteeText });
          replacements.push({ target: '[months]', text: guaranteeText });
        }

        // ── SERVICE FEE PERCENTAGE PLACEHOLDERS ────────────────────────────────
        if (serviceFee) {
          let feeText = serviceFee.trim();
          // Auto-append '%' if only a number (optionally with decimal) is provided
          if (/^\d+(\.\d+)?$/.test(feeText)) {
            feeText = feeText + '%';
          }
          replacements.push({ target: 'xx%', text: feeText });
          replacements.push({ target: 'xx %', text: feeText });
          replacements.push({ target: 'XX%', text: feeText });
          replacements.push({ target: 'XX %', text: feeText });
          replacements.push({ target: 'xxx%', text: feeText });
          replacements.push({ target: 'xxx_%', text: feeText });
          replacements.push({ target: '[fee]', text: feeText });
          replacements.push({ target: 'Rs . XX%', text: `Rs . ${feeText}` });
          replacements.push({ target: 'Rs . XX %', text: `Rs . ${feeText}` });
        }

        if (replacements.length > 0) {
          const pageLines = pdfLines.filter(l => l.page === pageNum);
          pageLines.sort((a, b) => b.y - a.y);

          let chars = [];
          pageLines.forEach(line => {
            line.items.forEach((item, index) => {
              if (index > 0) {
                chars.push({ char: ' ', item: null, delete: false });
              }
              for (let i = 0; i < item.str.length; i++) {
                chars.push({ char: item.str[i], item: item, delete: false });
              }
            });
            chars.push({ char: '\n', item: null });
          });

          const combinedText = chars.map(c => c.char).join('');
          const modifiedItems = new Map();

          replacements.forEach(({ target, text, bg }) => {
            if (!target || !text) return;
            const escapedTarget = target.trim().replace(/\s+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flexibleTarget = escapedTarget.replace(/ /g, '(?:\\s+)').replace(/['’]/g, "['’]");
            const replaceRegex = new RegExp(flexibleTarget, "gi");

            let match;
            while ((match = replaceRegex.exec(combinedText)) !== null) {
              const startIndex = match.index;
              const endIndex = startIndex + match[0].length;

              // Check if any character in the match has already been deleted
              let alreadyDeleted = false;
              for (let i = startIndex; i < endIndex; i++) {
                if (chars[i] && chars[i].delete) {
                  alreadyDeleted = true;
                  break;
                }
              }
              if (alreadyDeleted) continue;

              const matchItemsSet = new Set();
              for (let i = startIndex; i < endIndex; i++) {
                if (chars[i].item) matchItemsSet.add(chars[i].item);
                if (chars[i].item || chars[i].char === ' ') chars[i].delete = true;
              }

              const matchItems = Array.from(matchItemsSet);
              const compWords = text.split(/\s+/).filter(w => w);
              const buckets = Array.from({ length: matchItems.length }, () => []);

              if (compWords.length > 0 && matchItems.length > 0) {
                for (let i = 0; i < compWords.length; i++) {
                  const bucketIndex = Math.min(Math.floor((i / compWords.length) * matchItems.length), matchItems.length - 1);
                  buckets[bucketIndex].push(compWords[i]);
                }
              }

              matchItems.forEach((item, itemIdx) => {
                let inserted = false;
                for (let i = startIndex; i < endIndex; i++) {
                  if (chars[i].item === item && chars[i].delete && !inserted) {
                    chars[i].insert = buckets[itemIdx].join(' ');
                    inserted = true;
                  }
                }
                let calculatedBg = '#FFFFFF'; // Default White
                if (item.transform[5] > 710) {
                  calculatedBg = '#13B6D7'; // Blue Banner color
                }
                modifiedItems.set(item, calculatedBg);
              });
            }
          });

          const itemReplacementMap = new Map();
          pageLines.forEach(line => {
            line.items.forEach(item => {
              const itemChars = chars.filter(c => c.item === item);
              const hasMod = itemChars.some(c => c.delete || c.insert !== undefined);
              if (hasMod) {
                let newStr = "";
                itemChars.forEach(c => {
                  if (c.insert !== undefined) newStr += c.insert;
                  if (!c.delete) newStr += c.char;
                });
                itemReplacementMap.set(item, newStr);
              }
            });
          });

          // First pass: Erase all modified placeholder text elements
          itemReplacementMap.forEach((newStr, item) => {
            const itemX = item.transform[4];
            const itemY = item.transform[5];

            // Determine appropriate background color to erase the item
            let bgColorHex = '#FFFFFF';
            if (itemY > 710) {
              bgColorHex = '#13B6D7'; // Header banner background
            }
            const rgbColor = hexToRgb(bgColorHex);

            // Erase exactly the original text area — no padding to avoid visible colour bleed
            page.drawRectangle({
              x: itemX,
              y: itemY,
              width: item.width,
              height: item.height,
              color: rgb(rgbColor.r, rgbColor.g, rgbColor.b)
            });
          });

          // Second pass: Write the new text for all modified placeholder text elements
          itemReplacementMap.forEach((newStr, item) => {
            if (newStr) {
              const itemX = item.transform[4];
              const itemY = item.transform[5];
              const originalFontSize = (item.transform && item.transform[3])
                ? Math.abs(item.transform[3])
                : (item.height || 12);

              page.drawText(newStr, {
                x: itemX,
                y: itemY,
                size: originalFontSize,
                font: helveticaFont,
                color: rgb(textColorRgb.r, textColorRgb.g, textColorRgb.b)
              });
            }
          });
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedBase64 = uint8ArrayToBase64(modifiedPdfBytes);
      const modifiedDataUrl = `data:application/pdf;base64,${modifiedBase64}`;

      setPreviewPdfData(modifiedDataUrl);

    } catch (err) {
      console.error("Error generating PDF preview:", err);
      // Optional alert for easier debugging if it fails silently again
      console.log("PDF generation failed. Error details:", err.message);
    }
  };

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

import React, { useState, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Copy,
  Heading1,
  Type,
  CalendarDays,
  Building2,
  Table2,
  Image as ImageIcon,
  Minus,
  Square,
} from 'lucide-react';
import { buildTemplatePdf, uint8ArrayToBase64, CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX } from '../../utils/templateBuilder';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const WIDGETS = [
  { type: 'heading', label: 'Heading', icon: Heading1, defaults: { width: 460, height: 40, fontSize: 22, bold: true, italic: false, underline: false, align: 'left', color: '#111827', fontFamily: 'Helvetica', text: 'Heading Text' } },
  { type: 'text', label: 'Paragraph', icon: Type, defaults: { width: 460, height: 90, fontSize: 12, bold: false, italic: false, underline: false, align: 'left', color: '#111827', fontFamily: 'Helvetica', text: 'Add your paragraph text here…' } },
  { type: 'dateField', label: 'Date Field', icon: CalendarDays, defaults: { width: 180, height: 24, fontSize: 12, bold: true, italic: false, underline: false, align: 'left', color: '#111827', fontFamily: 'Helvetica' } },
  { type: 'companyField', label: 'Company (To) Field', icon: Building2, defaults: { width: 280, height: 24, fontSize: 12, bold: true, italic: false, underline: false, align: 'left', color: '#111827', fontFamily: 'Helvetica' } },
  { type: 'table', label: 'Position Table', icon: Table2, defaults: { width: 734, height: 220, rows: 3, fontFamily: 'Helvetica' } },
  { type: 'image', label: 'Logo / Image', icon: ImageIcon, defaults: { width: 120, height: 120 } },
  { type: 'divider', label: 'Divider Line', icon: Minus, defaults: { width: 734, height: 2, color: '#111827' } },
  { type: 'banner', label: 'Header Banner', icon: Square, defaults: { width: 794, height: 170, bgColor: '#13B6D7' } },
];

const FONT_OPTIONS = ['Helvetica', 'Inter', 'Montserrat', 'Arial', 'Times New Roman'];
const TEXT_TYPES = new Set(['heading', 'text', 'dateField', 'companyField']);

let widgetSeq = 0;

const WidgetPalette = ({ onAdd }) => (
  <div style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 4px' }}>Widgets</h4>
    {WIDGETS.map((w) => {
      const Icon = w.icon;
      return (
        <button
          key={w.type}
          onClick={() => onAdd(w)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
            background: 'white', border: '1px solid #E5E7EB', borderRadius: '10px',
            fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5D1CC9'; e.currentTarget.style.color = '#5D1CC9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151'; }}
        >
          <Icon size={16} />
          {w.label}
        </button>
      );
    })}
  </div>
);

const NumberField = ({ label, value, onChange, min = 0, max = 2000, step = 1 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>{label}</label>
    <input
      type="number"
      value={Math.round(value)}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(clamp(Number(e.target.value) || 0, min, max))}
      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', outline: 'none' }}
    />
  </div>
);

const PropertiesPanel = ({ element, onUpdate, onDelete, onDuplicate, onUploadImage }) => {
  if (!element) {
    return (
      <div style={{ width: '240px', flexShrink: 0, padding: '16px', color: '#9CA3AF', fontSize: '13px', textAlign: 'center' }}>
        Select a widget on the canvas to edit its properties.
      </div>
    );
  }

  const isText = TEXT_TYPES.has(element.type);
  const isEditableText = element.type === 'heading' || element.type === 'text';

  return (
    <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Properties</h4>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onDuplicate} title="Duplicate" style={{ background: 'white', border: '1px solid #E5E7EB', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#6B7280', display: 'flex' }}>
            <Copy size={14} />
          </button>
          <button onClick={onDelete} title="Delete" style={{ background: 'white', border: '1px solid #E5E7EB', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#EF4444', display: 'flex' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isEditableText && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Text</label>
          <textarea
            value={element.text || ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            rows={3}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      )}
      {element.type === 'dateField' && (
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>Shows as "Date :" — the actual date is filled in automatically when a quotation is created from this template.</p>
      )}
      {element.type === 'companyField' && (
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>Shows as "To :" — the client's company name is filled in automatically when a quotation is created from this template.</p>
      )}

      {isText && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Font</label>
            <select
              value={element.fontFamily || 'Helvetica'}
              onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '12px', outline: 'none' }}
            >
              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <NumberField label="Font size" value={element.fontSize || 12} min={6} max={72} onChange={(v) => onUpdate({ fontSize: v })} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Color</label>
              <input type="color" value={element.color || '#111827'} onChange={(e) => onUpdate({ color: e.target.value })} style={{ width: '100%', height: '30px', padding: '2px', borderRadius: '6px', border: '1px solid #D1D5DB', cursor: 'pointer' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bold size={16} cursor="pointer" color={element.bold ? '#5D1CC9' : '#9CA3AF'} onClick={() => onUpdate({ bold: !element.bold })} />
            <Italic size={16} cursor="pointer" color={element.italic ? '#5D1CC9' : '#9CA3AF'} onClick={() => onUpdate({ italic: !element.italic })} />
            <Underline size={16} cursor="pointer" color={element.underline ? '#5D1CC9' : '#9CA3AF'} onClick={() => onUpdate({ underline: !element.underline })} />
            <span style={{ width: '1px', height: '16px', background: '#E5E7EB' }} />
            <AlignLeft size={16} cursor="pointer" color={element.align === 'left' || !element.align ? '#5D1CC9' : '#9CA3AF'} onClick={() => onUpdate({ align: 'left' })} />
            <AlignCenter size={16} cursor="pointer" color={element.align === 'center' ? '#5D1CC9' : '#9CA3AF'} onClick={() => onUpdate({ align: 'center' })} />
            <AlignRight size={16} cursor="pointer" color={element.align === 'right' ? '#5D1CC9' : '#9CA3AF'} onClick={() => onUpdate({ align: 'right' })} />
          </div>
        </>
      )}

      {element.type === 'table' && (
        <NumberField label="Placeholder rows" value={element.rows || 3} min={1} max={15} onChange={(v) => onUpdate({ rows: v })} />
      )}

      {element.type === 'image' && (
        <button
          onClick={onUploadImage}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', background: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#374151' }}
        >
          {element.src ? 'Replace Image' : 'Upload Image'}
        </button>
      )}

      {(element.type === 'divider' || element.type === 'banner') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280' }}>Color</label>
          <input
            type="color"
            value={(element.type === 'banner' ? element.bgColor : element.color) || '#111827'}
            onChange={(e) => onUpdate(element.type === 'banner' ? { bgColor: e.target.value } : { color: e.target.value })}
            style={{ width: '100%', height: '30px', padding: '2px', borderRadius: '6px', border: '1px solid #D1D5DB', cursor: 'pointer' }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <NumberField label="X" value={element.x} max={CANVAS_WIDTH_PX} onChange={(v) => onUpdate({ x: v })} />
        <NumberField label="Y" value={element.y} max={CANVAS_HEIGHT_PX} onChange={(v) => onUpdate({ y: v })} />
        <NumberField label="Width" value={element.width} min={10} max={CANVAS_WIDTH_PX} onChange={(v) => onUpdate({ width: v })} />
        <NumberField label="Height" value={element.height} min={4} max={CANVAS_HEIGHT_PX} onChange={(v) => onUpdate({ height: v })} />
      </div>
    </div>
  );
};

const WidgetBox = ({ element, isSelected, onPointerDown, onSelect }) => {
  const base = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    cursor: 'move',
    outline: isSelected ? '2px solid #5D1CC9' : '1px dashed transparent',
    outlineOffset: '2px',
    boxSizing: 'border-box',
  };

  const handlers = {
    onPointerDown: (e) => onPointerDown(e, element.id),
    onClick: (e) => { e.stopPropagation(); onSelect(element.id); },
  };

  if (element.type === 'banner') {
    return <div {...handlers} style={{ ...base, background: element.bgColor }} />;
  }
  if (element.type === 'divider') {
    return <div {...handlers} style={{ ...base, background: element.color }} />;
  }
  if (element.type === 'image') {
    return (
      <div {...handlers} style={{ ...base, background: element.src ? `url(${element.src}) center/contain no-repeat` : '#F3F4F6', border: '1px dashed #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '11px' }}>
        {!element.src && 'No image'}
      </div>
    );
  }
  if (element.type === 'table') {
    const rows = Math.max(1, element.rows || 3);
    return (
      <div {...handlers} style={{ ...base, border: '1px solid #111827', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #111827', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
          {['S.No', 'Role', 'No of Positions', 'Qualifications', 'Package'].map((h, i) => (
            <div key={h} style={{ flex: i === 0 ? '0 0 8%' : i === 1 ? '0 0 24%' : i === 2 ? '0 0 24%' : i === 3 ? '0 0 22%' : '1 1 auto', padding: '4px', borderRight: i < 4 ? '1px solid #111827' : 'none', textAlign: 'center' }}>{h}</div>
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ flex: 1, borderBottom: r < rows - 1 ? '1px solid #D1D5DB' : 'none' }} />
        ))}
      </div>
    );
  }
  // heading / text / dateField / companyField
  const text = element.type === 'dateField' ? 'Date :' : element.type === 'companyField' ? 'To :' : element.text;
  return (
    <div
      {...handlers}
      style={{
        ...base,
        fontFamily: element.fontFamily === 'Times New Roman' ? 'Georgia, serif' : element.fontFamily || 'inherit',
        fontSize: `${element.fontSize || 12}px`,
        fontWeight: element.bold ? 700 : 400,
        fontStyle: element.italic ? 'italic' : 'normal',
        textDecoration: element.underline ? 'underline' : 'none',
        textAlign: element.align || 'left',
        color: element.color || '#111827',
        whiteSpace: 'pre-wrap',
        overflow: 'hidden',
        padding: '2px',
      }}
    >
      {text}
    </div>
  );
};

const TemplateEditorView = ({ onBack, onSave, docName = 'New Quotation Template' }) => {
  const [templateName, setTemplateName] = useState(docName);
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef(null);
  const canvasRef = useRef(null);
  const dragState = useRef(null);

  const selected = elements.find((e) => e.id === selectedId) || null;

  const addWidget = (widget) => {
    const id = `${widget.type}-${Date.now()}-${widgetSeq++}`;
    const cascade = (elements.length % 8) * 16;
    const newEl = {
      id,
      type: widget.type,
      x: widget.type === 'banner' ? 0 : 30 + cascade,
      y: widget.type === 'banner' ? 0 : 30 + cascade,
      ...widget.defaults,
    };
    setElements((prev) => (widget.type === 'banner' ? [newEl, ...prev] : [...prev, newEl]));
    setSelectedId(id);
  };

  const updateSelected = (patch) => {
    if (!selectedId) return;
    setElements((prev) => prev.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const id = `${selected.type}-${Date.now()}-${widgetSeq++}`;
    const copy = { ...selected, id, x: clamp(selected.x + 16, 0, CANVAS_WIDTH_PX - selected.width), y: clamp(selected.y + 16, 0, CANVAS_HEIGHT_PX - selected.height) };
    setElements((prev) => [...prev, copy]);
    setSelectedId(id);
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateSelected({ src: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePointerMove = useCallback((e) => {
    const d = dragState.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setElements((prev) => prev.map((el) => (
      el.id === d.id
        ? { ...el, x: clamp(d.origX + dx, 0, CANVAS_WIDTH_PX - el.width), y: clamp(d.origY + dy, 0, CANVAS_HEIGHT_PX - el.height) }
        : el
    )));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback((e, id) => {
    e.stopPropagation();
    setSelectedId(id);
    setElements((prev) => {
      const el = prev.find((x) => x.id === id);
      if (el) dragState.current = { id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
      return prev;
    });
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove, handlePointerUp]);

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name.');
      return;
    }
    if (elements.length === 0) {
      alert('Add at least one widget to the canvas before saving.');
      return;
    }
    setSaving(true);
    try {
      const pdfBytes = await buildTemplatePdf(elements, { widthPx: CANVAS_WIDTH_PX, heightPx: CANVAS_HEIGHT_PX });
      const dataUrl = `data:application/pdf;base64,${uint8ArrayToBase64(pdfBytes)}`;
      const newDoc = {
        name: templateName.trim(),
        type: 'Quotation',
        edited: 'Just Now',
        file: dataUrl,
        fileName: `${templateName.trim()}.pdf`,
      };
      await onSave?.(newDoc);
      onBack();
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Failed to save the template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-content" style={{ padding: '30px', fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Breadcrumb */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>
        Template &gt; Quotation &gt; {templateName || 'Untitled'}
      </div>

      {/* Main Title Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <button
            onClick={onBack}
            style={{ background: '#5D1CC9', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', boxShadow: '0 2px 4px rgba(93, 28, 201, 0.2)', flexShrink: 0 }}
          >
            <ArrowLeft size={18} />
          </button>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name"
            style={{ fontSize: '20px', fontWeight: '700', color: '#111827', border: 'none', outline: 'none', borderBottom: '2px solid transparent', background: 'transparent', flex: 1, maxWidth: '420px' }}
            onFocus={(e) => e.target.style.borderBottomColor = '#5D1CC9'}
            onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: '#5D1CC9', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 10px rgba(93, 28, 201, 0.2)', flexShrink: 0 }}
        >
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>

      <input type="file" accept="image/png,image/jpeg" ref={imageInputRef} style={{ display: 'none' }} onChange={handleImageFile} />

      {/* Main Content: Widgets | Canvas | Properties */}
      <div style={{ flex: 1, display: 'flex', gap: '20px', overflow: 'hidden' }}>
        <WidgetPalette onAdd={addWidget} />

        <div
          style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#F9FAFB', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'auto' }}
          onClick={() => setSelectedId(null)}
        >
          <div
            ref={canvasRef}
            style={{
              width: `${CANVAS_WIDTH_PX}px`,
              height: `${CANVAS_HEIGHT_PX}px`,
              background: 'white',
              position: 'relative',
              border: '2px dashed #3B82F6',
              boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
              flexShrink: 0,
            }}
          >
            {elements.length === 0 && (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
                Add widgets from the left panel to start designing your template.
              </div>
            )}
            {elements.map((el) => (
              <WidgetBox key={el.id} element={el} isSelected={el.id === selectedId} onPointerDown={handlePointerDown} onSelect={setSelectedId} />
            ))}
          </div>
        </div>

        <PropertiesPanel
          element={selected}
          onUpdate={updateSelected}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onUploadImage={() => imageInputRef.current?.click()}
        />
      </div>
    </div>
  );
};

export default TemplateEditorView;

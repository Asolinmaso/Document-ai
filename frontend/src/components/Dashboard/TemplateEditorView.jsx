import React, { useState } from 'react';
import { 
  ArrowLeft,
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
  RemoveFormatting,
  Trash2,
  Copy,
  Maximize2
} from 'lucide-react';

const TemplateEditorView = ({ onBack, docName = "Recruitment Template" }) => {
  return (
    <div className="dashboard-content" style={{ padding: '30px', fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Breadcrumb */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>
        Template &gt; Quotation &gt; {docName}
      </div>

      {/* Main Title Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            {docName}
          </h2>
        </div>
        
        <button style={{ 
          background: '#6C2BD9', 
          border: 'none', 
          color: 'white', 
          padding: '10px 24px', 
          borderRadius: '8px', 
          fontSize: '14px', 
          fontWeight: '600', 
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(108, 43, 217, 0.2)'
        }}>
          Save Template
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '24px', 
        padding: '10px 16px', 
        border: '1px solid #D1D5DB', 
        borderRadius: '8px',
        marginBottom: '24px',
        background: '#FAFAFA'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <select style={{ 
              border: '1px solid #D1D5DB', 
              borderRadius: '4px', 
              padding: '6px 28px 6px 12px', 
              fontSize: '13px', 
              outline: 'none', 
              fontFamily: 'Montserrat, sans-serif',
              appearance: 'none',
              background: 'white',
              color: '#374151',
              cursor: 'pointer'
            }}>
              <option>Montserrat</option>
              <option>Inter</option>
            </select>
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '10px', color: '#6B7280' }}>▼</span>
          </div>

          <div style={{ position: 'relative' }}>
            <select style={{ 
              border: '1px solid #D1D5DB', 
              borderRadius: '4px', 
              padding: '6px 24px 6px 12px', 
              fontSize: '13px', 
              outline: 'none',
              appearance: 'none',
              background: 'white',
              color: '#374151',
              cursor: 'pointer'
            }}>
              <option>12</option>
              <option>14</option>
              <option>16</option>
            </select>
            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '10px', color: '#6B7280' }}>▼</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontWeight: '800', fontSize: '15px', cursor: 'pointer', color: '#111827', fontFamily: 'serif' }}>B</span>
          <span style={{ fontStyle: 'italic', fontWeight: '700', fontSize: '15px', cursor: 'pointer', color: '#111827', fontFamily: 'serif' }}>I</span>
          <span style={{ textDecoration: 'underline', fontWeight: '600', fontSize: '15px', cursor: 'pointer', color: '#111827' }}>U</span>
          <span style={{ textDecoration: 'line-through', fontWeight: '500', fontSize: '15px', cursor: 'pointer', color: '#111827' }}>S</span>
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#111827' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', borderBottom: '2px solid #111827', paddingBottom: '1px' }}>A</span>
            <span style={{ fontSize: '10px', marginLeft: '2px', color: '#6B7280' }}>▼</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#374151' }}>
          <AlignLeft size={18} style={{ cursor: 'pointer' }} />
          <AlignCenter size={18} style={{ cursor: 'pointer' }} />
          <AlignRight size={18} style={{ cursor: 'pointer' }} />
          <AlignJustify size={18} style={{ cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#374151' }}>
          <List size={18} style={{ cursor: 'pointer' }} />
          <ListOrdered size={18} style={{ cursor: 'pointer' }} />
          <Link size={17} style={{ cursor: 'pointer' }} />
          <RemoveFormatting size={18} style={{ cursor: 'pointer' }} />
        </div>
      </div>

      {/* Main Content Area: Document Canvas */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#F9FAFB', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB', overflowY: 'auto' }}>
        
        {/* Canvas Container */}
        <div style={{ 
          width: '794px', // A4 width at 96 PPI
          height: '1123px', // A4 height at 96 PPI
          background: 'white',
          position: 'relative',
          border: '2px dashed #3B82F6', // Blue dashed border like the design
          boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          
          {/* Action Icons at top right inside canvas */}
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '8px', zIndex: 10 }}>
            <button style={{ background: 'white', border: '1px solid #E5E7EB', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <Trash2 size={14} />
            </button>
            <button style={{ background: 'white', border: '1px solid #E5E7EB', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <Copy size={14} />
            </button>
            <button style={{ background: 'white', border: '1px solid #E5E7EB', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Placeholder for Document Image (We can use the logo to simulate document content for now, or just an empty editable area) */}
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
             {/* If a template image/pdf is provided, it would render here. The user mockup just shows a dummy image */}
             <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                <p>Drag and drop elements here</p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TemplateEditorView;

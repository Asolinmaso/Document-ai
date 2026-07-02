import React from 'react';
import { 
  FileText, 
  Trash2, 
  Edit
} from 'lucide-react';

const SolidDocIcon = ({ color, size = 'md' }) => {
  const width = size === 'sm' ? '30px' : '40px';
  const height = size === 'sm' ? '38px' : '50px';
  return (
    <div style={{ 
      width, 
      height, 
      background: color, 
      borderRadius: '4px', 
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 4px 10px ${color}20`
    }}>
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        right: 0, 
        width: '10px', 
        height: '10px', 
        background: 'rgba(255,255,255,0.4)', 
        borderBottomLeftRadius: '3px' 
      }}></div>
      <div style={{ width: '50%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '30%' }}></div>
      <div style={{ width: '50%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '45%' }}></div>
      <div style={{ width: '30%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '60%', left: '25%' }}></div>
    </div>
  );
};

const DocumentView = ({ docs = [], searchQuery = '', onActionClick, onRowClick, onDeleteDocument, onEditDocument }) => {
  const categories = [
    { name: 'Quotation', color: '#6366F1' },
    { name: 'Invoice', color: '#EF4444' },
    { name: 'MOU', color: '#10B981' },
    { name: 'NDA', color: '#3B82F6' },
    { name: 'MOM', color: '#F59E0B' },
    { name: 'Offer Letter', color: '#06B6D4' },
    { name: 'Experience Letter', color: '#EAB308' },
    { name: 'Testimonial', color: '#4F46E5' },
    { name: 'Certificate', color: '#8B5CF6' },
  ];

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h3 className="section-title" style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '20px' }}>Create Document</h3>
        <div className="quick-actions-grid" style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
          gap: '20px',
          borderBottom: '1.5px solid #111827',
          paddingBottom: '30px',
          marginBottom: '40px'
        }}>
          {categories.map((cat, i) => (
            <div 
              key={i} 
              className="action-card" 
              onClick={() => onActionClick && onActionClick(`Create ${cat.name}`)}
              style={{ padding: '20px 10px', borderRadius: '16px', border: '1px solid #F3F4F6', background: 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <SolidDocIcon color={cat.color} size="sm" />
              <p style={{ fontWeight: '700', color: '#111827', fontSize: '13px', margin: 0 }}>{cat.name}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="section-title" style={{ fontSize: '20px', fontWeight: '700', marginBottom: '25px', color: '#111827' }}>Recent Documents ({docs.length})</h3>
        <div style={{ background: 'transparent' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #111827' }}>
                <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700' }}>Name</th>
                <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700' }}>Type</th>
                <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700' }}>Edited</th>
                <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr key={doc.id || i} style={{ borderBottom: i === docs.length - 1 ? 'none' : '1px solid #111827', cursor: 'pointer' }} onClick={() => onRowClick && onRowClick(doc)}>
                  <td style={{ padding: '20px 0' }}>
                    <div className="doc-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="doc-icon" style={{ background: '#6C2BD9', color: 'white', borderRadius: '4px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <FileText size={16} />
                      </div>
                      <span style={{ fontWeight: '500', color: '#111827', fontSize: '14px' }}>{doc.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '20px 0', color: '#4B5563', fontSize: '14px' }}>{doc.type}</td>
                  <td style={{ padding: '20px 0', color: '#4B5563', fontSize: '14px' }}>{doc.edited}</td>
                  <td style={{ padding: '20px 0', textAlign: 'right' }}>
                    <div className="action-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteDocument && onDeleteDocument(doc.id); }} 
                        style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer' }}
                      ><Trash2 size={18} /></button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onEditDocument && onEditDocument(doc); }} 
                        style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer' }}
                      ><Edit size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DocumentView;

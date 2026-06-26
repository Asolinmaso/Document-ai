import React, { useState } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  Trash, 
  FileText
} from 'lucide-react';

const TrashView = ({ docs = [], onRestore, onDeletePermanently, onEmptyTrash }) => {
  const [selectedDocs, setSelectedDocs] = useState([]);

  const toggleSelect = (id) => {
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleRestore = (id, name) => {
    onRestore(id);
    alert(`Restored ${name} successfully!`);
  };

  const handleRestoreSelected = () => {
    selectedDocs.forEach(id => onRestore(id));
    setSelectedDocs([]);
    alert(`Restored ${selectedDocs.length} items successfully!`);
  };

  const handleDeletePermanently = (id) => {
    if (window.confirm('Are you sure you want to delete this document permanently?')) {
      onDeletePermanently(id);
    }
  };
  
  const handleEmptyTrash = () => {
    if (docs.length === 0) return;
    if (window.confirm('Are you sure you want to empty the trash? This cannot be undone.')) {
      onEmptyTrash();
    }
  };

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      {/* Trash Banner */}
      <div style={{ 
        background: '#F9FAFB', 
        borderRadius: '24px', 
        padding: '30px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '40px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            background: '#6C2BD9', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white'
          }}>
            <Trash2 size={30} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>This is your trash</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, maxWidth: '400px', lineHeight: '1.5' }}>
              The documents and template you've deleted are moved here. You can restore them or delete permanently.
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleRestoreSelected}
            disabled={selectedDocs.length === 0}
            style={{ 
              background: 'white', 
              border: '1.5px solid #6C2BD9', 
              color: '#6C2BD9', 
              padding: '10px 20px', 
              borderRadius: '10px', 
              fontSize: '13px', 
              fontWeight: '600', 
              cursor: selectedDocs.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: selectedDocs.length === 0 ? 0.5 : 1
            }}
          >
            <RotateCcw size={16} /> Restore Selected
          </button>
          <button 
            onClick={handleEmptyTrash}
            style={{ 
              background: '#EF4444', 
              border: 'none', 
              color: 'white', 
              padding: '10px 20px', 
              borderRadius: '10px', 
              fontSize: '13px', 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Trash size={16} /> Empty Trash
          </button>
        </div>
      </div>

      {/* Trash Table */}
      <div style={{ background: 'transparent' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #111827' }}>
              <th style={{ padding: '12px 10px', width: '40px' }}>
                <input type="checkbox" style={{ cursor: 'pointer' }} onChange={(e) => {
                  if (e.target.checked) setSelectedDocs(docs.map(d => d.id));
                  else setSelectedDocs([]);
                }} />
              </th>
              <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700' }}>Name</th>
              <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700' }}>Type</th>
              <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, i) => (
              <tr key={doc.id} style={{ borderBottom: i === docs.length - 1 ? 'none' : '1px solid #111827' }}>
                <td style={{ padding: '20px 10px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td style={{ padding: '20px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#6C2BD9', color: 'white', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <FileText size={18} />
                    </div>
                    <span style={{ fontWeight: '500', color: '#111827', fontSize: '14px' }}>{doc.name}</span>
                  </div>
                </td>
                <td style={{ padding: '20px 0', color: '#4B5563', fontSize: '14px' }}>{doc.type}</td>
                <td style={{ padding: '20px 0', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleRestore(doc.id, doc.name)}
                      style={{ 
                        background: 'white', 
                        border: '1.5px solid #6C2BD9', 
                        color: '#6C2BD9', 
                        padding: '6px 16px', 
                        borderRadius: '8px', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button 
                      onClick={() => handleDeletePermanently(doc.id)}
                      style={{ 
                        background: 'white', 
                        border: '1.5px solid #EF4444', 
                        color: '#EF4444', 
                        padding: '6px 16px', 
                        borderRadius: '8px', 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px', color: '#9CA3AF' }}>
            No documents found in trash.
          </div>
        )}
      </div>
    </div>
  );
};

export default TrashView;

import React, { useState } from 'react';
import { Trash2, RotateCcw, Trash, FileText } from 'lucide-react';

const TrashView = ({ docs = [], onRestore, onDeletePermanently, onEmptyTrash, showToast }) => {
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [confirming, setConfirming] = useState(null); // null | 'empty' | docId

  const toggleSelect = (id) =>
    setSelectedDocs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleSelectAll = (e) => {
    setSelectedDocs(e.target.checked ? docs.map((d) => d.id) : []);
  };

  const handleRestore = (id, name) => {
    onRestore(id);
    setSelectedDocs((prev) => prev.filter((x) => x !== id));
    showToast?.(`"${name}" restored successfully.`, 'success');
  };

  const handleRestoreSelected = () => {
    selectedDocs.forEach((id) => onRestore(id));
    showToast?.(`${selectedDocs.length} item(s) restored.`, 'success');
    setSelectedDocs([]);
  };

  const handleDeletePermanently = (id) => {
    setConfirming(id);
  };

  const handleEmptyTrash = () => {
    setConfirming('empty');
  };

  const confirmAction = () => {
    if (confirming === 'empty') {
      onEmptyTrash();
    } else {
      onDeletePermanently(confirming);
    }
    setConfirming(null);
  };

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>

      {/* Inline confirm dialog */}
      {confirming && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              {confirming === 'empty' ? 'Empty Trash?' : 'Delete Permanently?'}
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px', lineHeight: '1.5' }}>
              {confirming === 'empty'
                ? 'This will permanently delete all items in the trash. This action cannot be undone.'
                : 'This will permanently delete this document. This action cannot be undone.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setConfirming(null)} style={{ padding: '10px 24px', border: '1.5px solid #D1D5DB', background: 'white', color: '#374151', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmAction} style={{ padding: '10px 24px', background: '#EF4444', border: 'none', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      <div style={{ background: '#F9FAFB', borderRadius: '20px', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', background: '#FEE2E2', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={24} color="#EF4444" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 4px' }}>Trash</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
              {docs.length} item{docs.length !== 1 ? 's' : ''} in trash
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleRestoreSelected}
            disabled={selectedDocs.length === 0}
            style={{ background: 'white', border: '1.5px solid #6C2BD9', color: '#6C2BD9', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: selectedDocs.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: selectedDocs.length === 0 ? 0.4 : 1, transition: 'all 0.2s' }}
          >
            <RotateCcw size={14} /> Restore Selected ({selectedDocs.length})
          </button>
          <button
            onClick={handleEmptyTrash}
            disabled={docs.length === 0}
            style={{ background: docs.length === 0 ? '#F3F4F6' : '#EF4444', border: 'none', color: docs.length === 0 ? '#9CA3AF' : 'white', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: docs.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
          >
            <Trash size={14} /> Empty Trash
          </button>
        </div>
      </div>

      {/* Table */}
      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
          <Trash2 size={40} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
          <p style={{ fontSize: '15px', fontWeight: '500', margin: 0 }}>Trash is empty</p>
          <p style={{ fontSize: '13px', margin: '4px 0 0' }}>Deleted documents will appear here</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #E5E7EB' }}>
              <th style={{ padding: '10px', width: '40px' }}>
                <input
                  type="checkbox"
                  style={{ cursor: 'pointer', accentColor: '#6C2BD9' }}
                  checked={selectedDocs.length === docs.length && docs.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th style={{ padding: '10px 0', fontSize: '11px', color: '#6B7280', fontWeight: '600', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
              <th style={{ padding: '10px 0', fontSize: '11px', color: '#6B7280', fontWeight: '600', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
              <th style={{ padding: '10px 0', fontSize: '11px', color: '#6B7280', fontWeight: '600', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, i) => (
              <tr key={doc.id} style={{ borderBottom: i === docs.length - 1 ? 'none' : '1px solid #F3F4F6' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '14px 10px' }}>
                  <input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleSelect(doc.id)} style={{ cursor: 'pointer', accentColor: '#6C2BD9' }} />
                </td>
                <td style={{ padding: '14px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#FEE2E2', color: '#EF4444', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={14} />
                    </div>
                    <span style={{ fontWeight: '500', color: '#374151', fontSize: '13px' }}>{doc.name}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 0', color: '#9CA3AF', fontSize: '12px' }}>
                  <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: '20px' }}>{doc.type || '—'}</span>
                </td>
                <td style={{ padding: '14px 0', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleRestore(doc.id, doc.name)}
                      style={{ background: 'white', border: '1.5px solid #6C2BD9', color: '#6C2BD9', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <RotateCcw size={12} /> Restore
                    </button>
                    <button
                      onClick={() => handleDeletePermanently(doc.id)}
                      style={{ background: 'white', border: '1.5px solid #EF4444', color: '#EF4444', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default TrashView;

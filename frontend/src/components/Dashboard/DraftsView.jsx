import React from 'react';
import { FileText, Eye, Edit, Trash2, FilePen } from 'lucide-react';
import { companyOf, createdLabel, lastUpdatedLabel } from '../../utils/docs';

const TH = { padding: '12px 20px', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
const TD = { padding: '14px 20px', fontSize: '13px', color: '#374151' };
const iconBtn = { background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center' };

/** Quotations saved as draft: continue editing, preview or delete them. Finalizing/sending happens inside the editor. */
const DraftsView = ({ docs = [], now, onContinue, onPreview, onDelete }) => (
  <div className="dashboard-content" style={{ padding: '30px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
      <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Drafts</h2>
      <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>{docs.length}</span>
    </div>
    <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 24px 0' }}>
      Unfinished quotations. Continue editing, then finalize or send them from the editor.
    </p>

    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #E5E7EB' }}>
            <th style={TH}>Name</th>
            <th style={TH}>Company</th>
            <th style={TH}>Created</th>
            <th style={TH}>Last Updated</th>
            <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc.id} onClick={() => onContinue(doc)} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
              <td style={TD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={14} />
                  </div>
                  <span style={{ fontWeight: '600', color: '#111827' }}>{doc.name}</span>
                </div>
              </td>
              <td style={TD}>{companyOf(doc) || '—'}</td>
              <td style={{ ...TD, color: '#6B7280' }}>{createdLabel(doc)}</td>
              <td style={{ ...TD, color: '#6B7280' }}>{lastUpdatedLabel(doc, now)}</td>
              <td style={{ ...TD, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button title="Continue editing" aria-label="Continue editing" onClick={() => onContinue(doc)} style={{ ...iconBtn, color: '#5D1CC9' }}><Edit size={14} /></button>
                  <button title="Preview" aria-label="Preview" onClick={() => onPreview(doc)} style={iconBtn}><Eye size={14} /></button>
                  <button title="Delete draft" aria-label="Delete draft" onClick={() => onDelete(doc)} style={{ ...iconBtn, color: '#EF4444' }}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
          {docs.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: '50px', color: '#9CA3AF', fontSize: '14px' }}>
                <FilePen size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ margin: 0 }}>No drafts yet. Open a quotation and choose “Save As Draft” to keep it here.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default DraftsView;

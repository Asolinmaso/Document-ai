import React, { useState } from 'react';
import { ArrowLeft, FileText, Eye, Edit, Download, Link as LinkIcon, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { companyOf, createdLabel, lastUpdatedLabel, downloadPdf } from '../../utils/docs';

const TH = { padding: '12px 20px', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
const TD = { padding: '14px 20px', fontSize: '13px', color: '#374151' };
const iconBtn = { background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer', display: 'flex' };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'active', label: 'Final' },
  { key: 'sent', label: 'Sent' },
];

/**
 * Every quotation that was created, saved as a draft, finalized or sent (newest activity first).
 * Used both as the sidebar "History" section and from the Quotation screen (`onBack` adds a back arrow).
 */
const QuotationHistoryView = ({ docs = [], now, onBack, onView, onEdit, onDelete, showToast }) => {
  const [filter, setFilter] = useState('all');

  const counts = docs.reduce((acc, d) => ({ ...acc, [d.status]: (acc[d.status] || 0) + 1 }), {});
  const visible = filter === 'all' ? docs : docs.filter((d) => d.status === filter);

  const handleCopyLink = async (doc) => {
    const url = `${window.location.origin}${window.location.pathname}?docId=${doc.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast?.('Link copied to clipboard!', 'success');
    } catch {
      showToast?.('Could not copy the link. Please copy it manually.', 'error');
    }
  };

  const handleDownload = (doc) => {
    if (!doc.file) { showToast?.('This quotation has no file to download.', 'warning'); return; }
    downloadPdf(doc.file, doc.name);
  };

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      {onBack && (
        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '20px' }}>Document &gt; Quotation &gt; History</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
        {onBack && (
          <div
            onClick={onBack}
            role="button"
            aria-label="Back"
            style={{ width: '32px', height: '32px', background: '#5D1CC9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', boxShadow: '0 4px 10px rgba(93, 28, 201, 0.3)' }}
          >
            <ArrowLeft size={18} />
          </div>
        )}
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Quotation History</h2>
      </div>
      <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 20px 0' }}>Everything you have created, saved as a draft, finalized or sent.</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === 'all' ? docs.length : counts[f.key] || 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: active ? '1.5px solid #5D1CC9' : '1.5px solid #E5E7EB', background: active ? '#5D1CC9' : 'white', color: active ? 'white' : '#4B5563' }}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #E5E7EB' }}>
              <th style={TH}>Quotation</th>
              <th style={TH}>Company Name</th>
              <th style={TH}>Created</th>
              <th style={TH}>Last Updated</th>
              <th style={TH}>Status</th>
              <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((doc) => (
              <tr key={doc.id} onClick={() => onView?.(doc)} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
                <td style={TD}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#EDE9FE', color: '#5D1CC9', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={14} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#111827' }}>{doc.name}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>QT-{doc.id}</div>
                    </div>
                  </div>
                </td>
                <td style={TD}>{companyOf(doc) || '—'}</td>
                <td style={{ ...TD, color: '#6B7280' }}>{createdLabel(doc)}</td>
                <td style={{ ...TD, color: '#6B7280' }}>{lastUpdatedLabel(doc, now)}</td>
                <td style={TD}><StatusBadge status={doc.status} /></td>
                <td style={{ ...TD, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="icon-btn" title="View" aria-label="View" onClick={() => onView?.(doc)} style={iconBtn}><Eye size={14} /></button>
                    <button className="icon-btn" title={doc.status === 'draft' ? 'Continue editing' : 'Edit'} aria-label="Edit" onClick={() => onEdit?.(doc)} style={iconBtn}><Edit size={14} /></button>
                    <button className="icon-btn" title="Download" aria-label="Download" onClick={() => handleDownload(doc)} style={iconBtn}><Download size={14} /></button>
                    <button className="icon-btn" title="Copy Link" aria-label="Copy link" onClick={() => handleCopyLink(doc)} style={iconBtn}><LinkIcon size={14} /></button>
                    <button className="icon-btn" title="Delete" aria-label="Delete" onClick={() => onDelete?.(doc)} style={iconBtn}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '50px', color: '#9CA3AF', fontSize: '14px' }}>
                  <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>{docs.length === 0 ? 'No quotations yet.' : 'No quotations with this status.'}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuotationHistoryView;

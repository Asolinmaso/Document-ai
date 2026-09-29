import React from 'react';
import { ArrowLeft, FileText, Eye, Edit, Download, Link as LinkIcon, Trash2 } from 'lucide-react';

const STATUS_STYLES = {
  draft: { bg: '#FEF3C7', color: '#92400E', label: 'Draft' },
  active: { bg: '#DCFCE7', color: '#166534', label: 'Final' },
  sent: { bg: '#DBEAFE', color: '#1E40AF', label: 'Sent' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
      {s.label}
    </span>
  );
};

const downloadDocFile = (doc) => {
  if (!doc.file) return;
  const base64Data = doc.file.split(',')[1] || doc.file;
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const safeName = (doc.name || 'quotation').trim().replace(/[^a-z0-9\-_ ]+/gi, '').replace(/\s+/g, '_') || 'quotation';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const QuotationHistoryView = ({ docs = [], onBack, onView, onEdit, onDelete, showToast }) => {
  const handleCopyLink = async (doc) => {
    const url = `${window.location.origin}${window.location.pathname}?docId=${doc.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast?.('Link copied to clipboard!', 'success');
    } catch (err) {
      showToast?.('Could not copy the link. Please copy it manually.', 'error');
    }
  };

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '20px' }}>
        Document &gt; Quotation &gt; History
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '35px' }}>
        <div
          onClick={onBack}
          style={{
            width: '32px',
            height: '32px',
            background: '#5D1CC9',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(93, 28, 201, 0.3)'
          }}
        >
          <ArrowLeft size={18} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Quotation History</h2>
      </div>

      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #E5E7EB' }}>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quotation No.</th>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company Name</th>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created Date</th>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              <th style={{ padding: '12px 20px', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#EDE9FE', color: '#5D1CC9', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={14} />
                    </div>
                    <span style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>QT-{doc.id}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', color: '#374151', fontSize: '13px' }}>
                  {doc.quotationData?.companyName || '—'}
                </td>
                <td style={{ padding: '14px 20px', color: '#9CA3AF', fontSize: '13px' }}>{doc.edited || '—'}</td>
                <td style={{ padding: '14px 20px' }}>
                  <StatusBadge status={doc.status} />
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="icon-btn" title="View" onClick={() => onView?.(doc)} style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
                      <Eye size={14} />
                    </button>
                    <button className="icon-btn" title="Edit" onClick={() => onEdit?.(doc)} style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
                      <Edit size={14} />
                    </button>
                    <button className="icon-btn" title="Download" onClick={() => downloadDocFile(doc)} style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
                      <Download size={14} />
                    </button>
                    <button className="icon-btn" title="Copy Link" onClick={() => handleCopyLink(doc)} style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
                      <LinkIcon size={14} />
                    </button>
                    <button className="icon-btn" title="Delete" onClick={() => onDelete?.(doc.id)} style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '50px', color: '#9CA3AF', fontSize: '14px' }}>
                  <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>No quotations yet.</p>
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

import React from 'react';
import { Trash2 } from 'lucide-react';

/** Centered confirmation modal used before destructive actions (e.g. deleting a draft). */
const ConfirmDialog = ({ open, title, message, confirmLabel = 'Delete', busy = false, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}
      >
        <div style={{ width: '52px', height: '52px', background: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Trash2 size={22} color="#EF4444" />
        </div>
        <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>{title}</h3>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '22px', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} disabled={busy} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid #E5E7EB', background: 'white', fontWeight: '600', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#EF4444', fontWeight: '600', fontSize: '13px', color: 'white', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

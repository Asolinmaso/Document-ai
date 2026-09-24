import React from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICONS = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const COLORS = {
  success: { bg: '#10B981', border: '#059669' },
  error: { bg: '#EF4444', border: '#DC2626' },
  warning: { bg: '#F59E0B', border: '#D97706' },
  info: { bg: '#6C2BD9', border: '#5B21B6' },
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const color = COLORS[toast.type] || COLORS.info;
        return (
          <div
            key={toast.id}
            role="alert"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: color.bg,
              border: `1px solid ${color.border}`,
              color: 'white',
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              minWidth: '280px',
              maxWidth: '400px',
              pointerEvents: 'all',
              animation: 'toast-in 0.25s ease-out',
            }}
          >
            <span style={{ flexShrink: 0 }}>{ICONS[toast.type] || ICONS.info}</span>
            <span style={{ flex: 1, lineHeight: '1.4' }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ToastContainer;

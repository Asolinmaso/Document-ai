import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { isValidEmail } from '../../utils/passwordRules';

const labelStyle = { fontSize: '12px', fontWeight: '600', color: '#6B7280' };
const inputStyle = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', outline: 'none', fontSize: '13px', fontFamily: 'inherit', width: '100%' };

/** Collects recipient / subject / message, then hands them to `onSend` (which emails the PDF and marks the quotation Sent). */
const QuotationSendModal = ({ open, defaultSubject, sending, onSend, onClose }) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('Hello,\n\nPlease find the quotation attached.\n\nRegards');
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!isValidEmail(to)) { setError('Enter a valid recipient email address.'); return; }
    if (!subject.trim()) { setError('Enter a subject.'); return; }
    setError('');
    onSend({ to: to.trim(), subject: subject.trim(), message });
  };

  return (
    <div role="dialog" aria-modal="true" onClick={sending ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <form onSubmit={submit} noValidate onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0 }}>Send quotation</h3>
          <button type="button" onClick={onClose} disabled={sending} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex' }}><X size={20} /></button>
        </div>
        <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>The quotation is emailed as a PDF and marked as <strong>Sent</strong>.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle} htmlFor="send-to">To</label>
          <input id="send-to" type="email" value={to} onChange={(e) => { setTo(e.target.value); setError(''); }} placeholder="client@example.com" style={inputStyle} autoFocus />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle} htmlFor="send-subject">Subject</label>
          <input id="send-subject" type="text" value={subject} onChange={(e) => { setSubject(e.target.value); setError(''); }} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={labelStyle} htmlFor="send-message">Message</label>
          <textarea id="send-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        {error && <p role="alert" style={{ color: '#DC2626', fontSize: '12px', margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} disabled={sending} style={{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #E5E7EB', background: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer', color: '#374151' }}>Cancel</button>
          <button type="submit" disabled={sending} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#5D1CC9', color: 'white', fontWeight: '600', fontSize: '13px', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Send size={14} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuotationSendModal;

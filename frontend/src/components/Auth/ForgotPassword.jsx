import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowLeft, MailCheck } from 'lucide-react';
import { forgotPassword } from '../../services/auth';
import { isValidEmail } from '../../utils/passwordRules';

const RESEND_SECONDS = 60;

const ForgotPassword = ({ initialEmail = '', onBackToLogin }) => {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Countdown before the link can be requested again (the server enforces the same limit)
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSentTo(email.trim());
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err.message || 'Could not send the reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); send(); };

  const iconBadge = (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '56px', height: '56px', borderRadius: '16px',
      background: 'linear-gradient(135deg, #6C2BD9, #4F46E5)',
      marginBottom: '16px', boxShadow: '0 8px 20px rgba(108,43,217,0.4)',
    }}>
      {sentTo ? <MailCheck size={26} color="white" /> : <span style={{ fontSize: '24px' }}>🔑</span>}
    </div>
  );

  const errorBanner = error && (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
      fontSize: '13px', color: '#FCA5A5',
    }}>
      <AlertCircle size={16} style={{ flexShrink: 0 }} />
      <span>{error}</span>
    </div>
  );

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {iconBadge}
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            {sentTo ? 'Check your email' : 'Forgot your password?'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.5 }}>
            {sentTo
              ? <>If an account exists for <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{sentTo}</strong>, a reset link is on its way. It is valid for 60 minutes.</>
              : "Enter the email you signed up with and we'll send you a link to choose a new password."}
          </p>
        </div>

        {errorBanner}

        {sentTo ? (
          <>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', textAlign: 'center', marginBottom: '20px' }}>
              Can't find it? Check your spam folder.
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={loading || cooldown > 0}
              onClick={send}
              style={{ opacity: loading || cooldown > 0 ? 0.6 : 1 }}
            >
              {loading ? 'Sending…' : cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <input
                id="forgot-email"
                type="email"
                className="form-control"
                placeholder=" "
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoComplete="email"
                autoFocus
                required
              />
              <label htmlFor="forgot-email">Email address</label>
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '24px' }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="auth-footer" style={{ marginTop: '24px' }}>
          <a
            href="#"
            className="auth-link"
            onClick={(e) => { e.preventDefault(); onBackToLogin(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Back to login
          </a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

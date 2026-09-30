import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { forgotPassword } from '../../services/auth';
import { isValidEmail } from '../../utils/passwordRules';
import AuthLayout from './AuthLayout';
import { FormAlert, FormField, SubmitButton } from './FormField';

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

  return (
    <AuthLayout
      title={sentTo ? 'Check your email' : 'Forgot your password?'}
      subtitle={sentTo
        ? <>If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. It is valid for 60 minutes.</>
        : "Enter the email you signed up with and we'll send you a link to choose a new password."}
      footer={<button type="button" className="auth-link" onClick={onBackToLogin} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ArrowLeft size={14} /> Back to login</button>}
    >
      <FormAlert>{error}</FormAlert>
      {sentTo ? (
        <>
          <p style={{ color: '#6B7280', fontSize: '13px', marginBottom: '16px' }}>Can't find it? Check your spam folder.</p>
          <button type="button" className="btn-primary" disabled={loading || cooldown > 0} onClick={send}>
            {loading ? 'Sending…' : cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <FormField id="forgot-email" label="Email address" type="email" placeholder="you@company.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} autoComplete="email" autoFocus />
          <SubmitButton loading={loading} loadingText="Sending…">Send reset link</SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;

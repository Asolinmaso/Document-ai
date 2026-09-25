import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { resetPassword } from '../../services/auth';
import { isPasswordValid } from '../../utils/passwordRules';
import PasswordRequirements, { ValidationItem } from './PasswordRequirements';

const eyeButton = {
  position: 'absolute', right: '0', top: '6px', background: 'none', border: 'none',
  color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
};

const ResetPassword = ({ token, onSuccess, onRequestNewLink, onBackToLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid(password)) { setError('Password does not meet all requirements.'); return; }
    if (!passwordsMatch) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await resetPassword(token, password);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Could not reset your password. Please try again.');
      // Only an expired / used / unknown link is unrecoverable; validation errors can be corrected in place
      if (/invalid or has expired/i.test(err.message || '')) setLinkInvalid(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #6C2BD9, #4F46E5)',
            marginBottom: '16px', boxShadow: '0 8px 20px rgba(108,43,217,0.4)',
          }}>
            <span style={{ fontSize: '24px' }}>🔒</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Choose a new password
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            You'll be signed out on all other devices.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '12px 14px', marginBottom: '20px',
            fontSize: '13px', color: '#FCA5A5',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {linkInvalid ? (
          <button type="button" className="btn-primary" onClick={onRequestNewLink}>
            Request a new link
          </button>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <div className="input-wrapper">
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder=" "
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <label htmlFor="reset-password">New password</label>
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={eyeButton}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password && <PasswordRequirements password={password} />}
            </div>

            <div className="form-group">
              <div className="input-wrapper">
                <input
                  id="reset-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  className="form-control"
                  placeholder=" "
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  autoComplete="new-password"
                  required
                />
                <label htmlFor="reset-confirm-password">Confirm new password</label>
                <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Hide password' : 'Show password'} style={eyeButton}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && (
                <div style={{ marginTop: '6px' }}>
                  <ValidationItem label="Passwords match" isValid={!!passwordsMatch} />
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '16px' }}>
              {loading ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        )}

        <div className="auth-footer" style={{ marginTop: '20px' }}>
          <a href="#" className="auth-link" onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>
            Back to login
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

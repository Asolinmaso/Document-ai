import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { login } from '../../services/auth';

const Login = ({ onSignupClick, onLoginSuccess, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }

    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6C2BD9, #4F46E5)',
            marginBottom: '16px',
            boxShadow: '0 8px 20px rgba(108,43,217,0.4)',
          }}>
            <span style={{ fontSize: '24px' }}>📄</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Welcome back
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            Log in to your DocAI account
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#FCA5A5',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="form-group">
            <input
              id="login-email"
              type="email"
              className="form-control"
              placeholder=" "
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              required
            />
            <label htmlFor="login-email">Email address</label>
          </div>

          {/* Password */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#A78BFA', fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: '500' }}
                onClick={() => showToast?.('Password reset is not yet available.', 'info')}
              >
                Forgot password?
              </button>
            </div>
            <div className="input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder=" "
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
                required
              />
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '0',
                  top: '6px',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: '24px', position: 'relative' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{
                  width: '16px', height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: '24px' }}>
          Don't have an account?{' '}
          <a
            href="#"
            className="auth-link"
            onClick={(e) => { e.preventDefault(); onSignupClick(); }}
          >
            Create account
          </a>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Login;

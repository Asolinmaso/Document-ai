import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { signup, login } from '../../services/auth';
import { isValidEmail, isValidName, isPasswordValid } from '../../utils/passwordRules';
import PasswordRequirements, { ValidationItem } from './PasswordRequirements';

const Signup = ({ onLoginClick, onSignupSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!isValidName(name)) { setError('Your name must be between 2 and 100 characters.'); return; }
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    if (!isPasswordValid(password)) {
      setError('Password does not meet all requirements.'); return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.'); return;
    }

    setLoading(true);
    let created = false;
    try {
      // 1. Create the account
      await signup(name.trim(), email.trim(), password);
      created = true;
      // 2. Immediately log in so we get the token & user
      const data = await login(email.trim(), password);
      onSignupSuccess(data.user);
    } catch (err) {
      if (created) {
        // The account exists; only the automatic sign-in failed, so don't tell the user signup failed
        setError('Your account was created, but we could not sign you in automatically. Please log in.');
        setTimeout(onLoginClick, 2500);
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6C2BD9, #4F46E5)',
            marginBottom: '14px',
            boxShadow: '0 8px 20px rgba(108,43,217,0.4)',
          }}>
            <span style={{ fontSize: '24px' }}>📄</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.5px' }}>
            Create your account
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            Join DocAI and automate your documentation
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
            marginBottom: '16px',
            fontSize: '13px',
            color: '#FCA5A5',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <input
              id="signup-name"
              type="text"
              className="form-control"
              placeholder=" "
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              autoComplete="name"
              required
            />
            <label htmlFor="signup-name">Full name</label>
          </div>

          <div className="form-group">
            <input
              id="signup-email"
              type="email"
              className="form-control"
              placeholder=" "
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              required
            />
            <label htmlFor="signup-email">Email address</label>
          </div>

          <div className="form-group">
            <div className="input-wrapper">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder=" "
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                autoComplete="new-password"
                required
              />
              <label htmlFor="signup-password">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '0', top: '6px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {(isPasswordFocused || password) && <PasswordRequirements password={password} />}
          </div>

          <div className="form-group">
            <div className="input-wrapper">
              <input
                id="signup-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-control"
                placeholder=" "
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
                required
              />
              <label htmlFor="signup-confirm-password">Confirm password</label>
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '0', top: '6px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && (
              <div style={{ marginTop: '6px' }}>
                <ValidationItem label="Passwords match" isValid={!!passwordsMatch} />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: '16px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Creating account…
              </span>
            ) : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: '20px' }}>
          Already have an account?{' '}
          <a href="#" className="auth-link" onClick={(e) => { e.preventDefault(); onLoginClick(); }}>
            Sign in
          </a>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Signup;

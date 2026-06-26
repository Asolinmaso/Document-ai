import React, { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import GoogleAuthButton from './GoogleAuthButton';

const Signup = ({ onLoginClick, onSignupSuccess }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);


  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!hasMinLength || !hasUppercase || !hasSymbol) {
      setError('Please meet all password requirements.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    onSignupSuccess();
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <div className="auth-header">
          <h1>Create Your Account</h1>
          <p>Join & automate your documentation process in seconds.</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input type="text" className="form-control" placeholder=" " required />
            <label>Name</label>
          </div>
          
          <div className="form-group">
            <input type="email" className="form-control" placeholder=" " required />
            <label>Email</label>
          </div>
          
          <div className="form-group">
            <input type="text" className="form-control" placeholder=" " required />
            <label>Company Name</label>
          </div>
          
          <div className="form-group">
            <div className="input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-control" 
                placeholder=" " 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                required 
              />
              <label>Password</label>
              <div 
                onClick={() => setShowPassword(!showPassword)} 
                style={{ position: 'absolute', right: '0', top: '8px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </div>
            </div>
            {isPasswordFocused && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <ValidationItem label="8+ characters" isValid={hasMinLength} />
                <ValidationItem label="1 uppercase letter" isValid={hasUppercase} />
                <ValidationItem label="1 special character" isValid={hasSymbol} />
              </div>
            )}
          </div>
          
          <div className="form-group">
            <div className="input-wrapper">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                className="form-control" 
                placeholder=" " 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
              />
              <label>Confirm Password</label>
              <div 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                style={{ position: 'absolute', right: '0', top: '8px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              >
                {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </div>
            </div>
            {confirmPassword && (
              <div style={{ marginTop: '4px' }}>
                <ValidationItem label="Passwords match" isValid={passwordsMatch} />
              </div>
            )}
          </div>
          
          {error && <p style={{ color: '#EF4444', fontSize: '12px', marginBottom: '16px' }}>{error}</p>}
          
          <button type="submit" className="btn-primary">Create Account</button>
          
          <div className="divider-container">
            <div className="divider-line"></div>
            <span className="divider-text">or continue with</span>
            <div className="divider-line"></div>
          </div>
          
          <GoogleAuthButton onSuccess={onSignupSuccess} text="signup_with" />
        </form>
        
        <div className="auth-footer">
          Already Have An Account? <a href="#" className="auth-link" onClick={onLoginClick}>Login</a>
        </div>
      </div>
    </div>
  );
};

const ValidationItem = ({ label, isValid }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isValid ? '#10B981' : 'rgba(255,255,255,0.4)' }}>
    {isValid ? <Check size={12} /> : <X size={12} />}
    <span>{label}</span>
  </div>
);

export default Signup;

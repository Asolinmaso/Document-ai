import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import GoogleAuthButton from './GoogleAuthButton';
import { login } from '../../services/auth';
import { useAuth } from '../../hooks/useAuth';

const Login = ({ onSignupClick, onLoginSuccess }) => {
  const { setUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const data = await login(email, password);
      if (data.token) {
        setUser(data.user);
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <div className="auth-header" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px' }}>Welcome Back!</h1>
          <p>Log in to your account & continue creating amazing documents.</p>
        </div>
        
        {error && <div style={{ color: '#EF4444', marginBottom: '16px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input 
              type="email" 
              className="form-control" 
              placeholder=" " 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
            <label>Email</label>
          </div>
          
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <a href="#" className="auth-link" style={{ fontSize: '13px', marginLeft: 'auto' }}>Forgot Password?</a>
            </div>
            <div className="input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-control" 
                placeholder=" " 
                value={password}
                onChange={e => setPassword(e.target.value)}
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
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Continue'}
          </button>
          
          <div className="divider-container">
            <div className="divider-line"></div>
            <span className="divider-text">or continue with</span>
            <div className="divider-line"></div>
          </div>
          
          <GoogleAuthButton onSuccess={(res) => {
            // Future: send Google token to backend to verify and issue local JWT
            // For now we just bypass on UI layer, but ideally backend processes `res.credential`
            onLoginSuccess();
          }} text="signin_with" />
        </form>
        
        <div className="auth-footer">
          Don't have an account? <a href="#" className="auth-link" onClick={onSignupClick}>Sign Up</a>
        </div>
      </div>
    </div>
  );
};

export default Login;

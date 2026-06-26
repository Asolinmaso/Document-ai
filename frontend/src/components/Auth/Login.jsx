import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import GoogleAuthButton from './GoogleAuthButton';

const Login = ({ onSignupClick, onLoginSuccess }) => {
  const [showPassword, setShowPassword] = useState(false);


  const handleSubmit = (e) => {
    e.preventDefault();
    onLoginSuccess();
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass">
        <div className="auth-header" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px' }}>Welcome Back!</h1>
          <p>Log in to your account & continue creating amazing documents.</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input type="email" className="form-control" placeholder=" " required />
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
          
          <button type="submit" className="btn-primary">Continue</button>
          
          <div className="divider-container">
            <div className="divider-line"></div>
            <span className="divider-text">or continue with</span>
            <div className="divider-line"></div>
          </div>
          
          <GoogleAuthButton onSuccess={onLoginSuccess} text="signin_with" />
        </form>
        
        <div className="auth-footer">
          Don't have an account? <a href="#" className="auth-link" onClick={onSignupClick}>Sign Up</a>
        </div>
      </div>
    </div>
  );
};

export default Login;

import React, { useState, useEffect } from 'react';
import Signup from './components/Auth/Signup';
import Login from './components/Auth/Login';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import Dashboard from './components/Dashboard/Dashboard';
import ToastContainer from './components/ToastContainer';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';

function App() {
  const { user, setUser, loading, logout, sessionExpired, setSessionExpired } = useAuth();
  const { toasts, showToast, removeToast } = useToast();

  // Derive the initial view: if the user is already authenticated, go straight
  // to the dashboard; otherwise start at login.
  const [view, setView] = useState('login');
  // Email typed on the login form, carried over to "Forgot password"
  const [forgotEmail, setForgotEmail] = useState('');

  // The password-reset email links to  <site>/?reset_token=...  – read it once, then clean the URL
  // so the token doesn't linger in the address bar, history or referrers.
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token'));
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('reset_token')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // When auth state resolves, navigate accordingly (a reset link always wins)
  useEffect(() => {
    if (!loading) {
      setView(resetToken ? 'reset' : user ? 'dashboard' : 'login');
    }
  }, [user, loading, resetToken]);

  // Show an in-app message when a session expires
  useEffect(() => {
    if (sessionExpired) {
      showToast('Your session has expired. Please log in again.', 'warning', 5000);
      setSessionExpired(false);
      setView('login');
    }
  }, [sessionExpired, showToast, setSessionExpired]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#09021A',
        color: 'white',
        gap: '16px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: '#6C2BD9',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Loading…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setView('dashboard');
    showToast(`Welcome back, ${loggedInUser?.name || 'User'}!`, 'success');
  };

  const handleSignupSuccess = (newUser) => {
    setUser(newUser);
    setView('dashboard');
    showToast(`Account created! Welcome, ${newUser?.name || 'User'}!`, 'success');
  };

  const handleResetSuccess = () => {
    // Resetting signs out every older session; drop any local one too
    logout();
    setResetToken(null);
    setView('login');
    showToast('Password reset! Please log in with your new password.', 'success', 5000);
  };

  const handleLogout = () => {
    logout();
    setView('login');
    showToast('You have been logged out.', 'info');
  };

  const renderView = () => {
    switch (view) {
      case 'signup':
        return (
          <Signup
            onLoginClick={() => setView('login')}
            onSignupSuccess={handleSignupSuccess}
          />
        );
      case 'login':
        return (
          <Login
            onSignupClick={() => setView('signup')}
            onForgotClick={(email) => { setForgotEmail(email); setView('forgot'); }}
            onLoginSuccess={handleLoginSuccess}
          />
        );
      case 'forgot':
        return (
          <ForgotPassword
            initialEmail={forgotEmail}
            onBackToLogin={() => setView('login')}
          />
        );
      case 'reset':
        return (
          <ResetPassword
            token={resetToken}
            onSuccess={handleResetSuccess}
            onRequestNewLink={() => { setResetToken(null); setForgotEmail(''); setView('forgot'); }}
            onBackToLogin={() => { setResetToken(null); setView('login'); }}
          />
        );
      case 'dashboard':
        return (
          <Dashboard
            currentUser={user}
            onLogout={handleLogout}
            showToast={showToast}
          />
        );
      default:
        return (
          <Login
            onSignupClick={() => setView('signup')}
            onForgotClick={(email) => { setForgotEmail(email); setView('forgot'); }}
            onLoginSuccess={handleLoginSuccess}
          />
        );
    }
  };

  return (
    <div className="app">
      {renderView()}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default App;

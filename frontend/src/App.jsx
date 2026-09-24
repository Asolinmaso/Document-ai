import React, { useState, useEffect } from 'react';
import Signup from './components/Auth/Signup';
import Login from './components/Auth/Login';
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

  // When auth state resolves, navigate accordingly
  useEffect(() => {
    if (!loading) {
      setView(user ? 'dashboard' : 'login');
    }
  }, [user, loading]);

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
            showToast={showToast}
          />
        );
      case 'login':
        return (
          <Login
            onSignupClick={() => setView('signup')}
            onLoginSuccess={handleLoginSuccess}
            showToast={showToast}
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
            onLoginSuccess={handleLoginSuccess}
            showToast={showToast}
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

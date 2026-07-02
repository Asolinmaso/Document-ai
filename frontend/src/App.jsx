import React, { useState, useEffect } from 'react';
import Signup from './components/Auth/Signup';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState('signup'); // signup, login, dashboard

  useEffect(() => {
    if (user) {
      setView('dashboard');
    }
  }, [user]);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09021A', color: 'white' }}>Loading...</div>;
  }

  const renderView = () => {
    switch (view) {
      case 'signup':
        return <Signup onLoginClick={() => setView('login')} onSignupSuccess={() => setView('dashboard')} />;
      case 'login':
        return <Login onSignupClick={() => setView('signup')} onLoginSuccess={() => setView('dashboard')} />;
      case 'dashboard':
        return <Dashboard onLogout={() => { logout(); setView('login'); }} />;
      default:
        return <Signup onLoginClick={() => setView('login')} onSignupSuccess={() => setView('dashboard')} />;
    }
  };

  return (
    <div className="app">
      {renderView()}
    </div>
  );
}

export default App;

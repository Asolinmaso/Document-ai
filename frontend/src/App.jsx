import React, { useState } from 'react';
import Signup from './components/Auth/Signup';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';

function App() {
  const [view, setView] = useState('signup'); // signup, login, dashboard, google-auth

  const renderView = () => {
    switch (view) {
      case 'signup':
        return <Signup onLoginClick={() => setView('login')} onSignupSuccess={() => setView('dashboard')} />;
      case 'login':
        return <Login onSignupClick={() => setView('signup')} onLoginSuccess={() => setView('dashboard')} />;
      case 'dashboard':
        return <Dashboard onLogout={() => setView('login')} />;
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

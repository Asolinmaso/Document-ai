import React, { useState } from 'react';

const MockGoogleAuth = ({ onAuthSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const accounts = [
    { name: 'Demo User', email: 'demo@example.com', avatar: 'https://ui-avatars.com/api/?name=Demo+User' }
  ];

  const handleSelect = (user) => {
    setLoading(true);
    setTimeout(() => {
      onAuthSuccess();
    }, 1200);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: '"Google Sans", Roboto, Arial, sans-serif'
    }} onClick={onCancel}>
      <div style={{
        width: '380px',
        background: '#fff',
        padding: '36px 0 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        borderRadius: '8px',
        textAlign: 'center',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>

        {loading ? (
          <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="loader" style={{
              width: '32px',
              height: '32px',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #4285f4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}></div>
            <p style={{ color: '#5f6368', fontSize: '14px' }}>Connecting to DocAI...</p>
          </div>
        ) : (
          <>
            <img
              src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png"
              alt="Google"
              style={{ width: '75px', marginBottom: '16px' }}
            />
            <h1 style={{ fontSize: '24px', fontWeight: '400', margin: '0 0 8px', color: '#202124' }}>
              Choose an account
            </h1>
            <p style={{ fontSize: '15px', margin: '0 0 24px', color: '#202124' }}>
              to continue to <span style={{ color: '#4285f4', fontWeight: '500' }}>DocAI</span>
            </p>

            <div style={{ textAlign: 'left', borderTop: '1px solid #dadce0' }}>
              {accounts.map((user, i) => (
                <div
                  key={i}
                  onClick={() => handleSelect(user)}
                  style={{
                    padding: '12px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #dadce0',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <img src={user.avatar} alt={user.name} style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eee' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: '500', margin: 0, color: '#3c4043' }}>{user.name}</p>
                    <p style={{ fontSize: '12px', margin: 0, color: '#70757a' }}>{user.email}</p>
                  </div>
                </div>
              ))}
              <div
                style={{
                  padding: '12px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" /></svg>
                </div>
                <p style={{ fontSize: '14px', fontWeight: '500', margin: 0, color: '#3c4043' }}>Use another account</p>
              </div>
            </div>

            <div style={{ padding: '24px', textAlign: 'left', fontSize: '12px', color: '#5f6368', lineHeight: '1.4' }}>
              To continue, Google will share your name, email address, language preference, and profile picture with DocAI.
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MockGoogleAuth;

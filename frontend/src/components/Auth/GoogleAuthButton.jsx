import React, { useEffect, useRef } from 'react';

const GoogleAuthButton = ({ onSuccess, text = "signup_with" }) => {
  const buttonRef = useRef(null);

  useEffect(() => {
    /* global google */
    if (window.google) {
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "337074822738-kaucna6a1olvoo8qfvs8r320iekp9hi1.apps.googleusercontent.com",
        callback: (response) => {
          console.log("Google Auth Success", response);
          onSuccess(response);
        }
      });

      google.accounts.id.renderButton(
        buttonRef.current,
        { 
          theme: "outline", 
          size: "large", 
          width: 390,
          text: text,
          shape: "rectangular",
          logo_alignment: "left"
        }
      );

      // Optional: Show One Tap prompt automatically
      google.accounts.id.prompt();
    }
  }, [onSuccess, text]);

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
      <div ref={buttonRef}></div>
    </div>
  );
};

export default GoogleAuthButton;

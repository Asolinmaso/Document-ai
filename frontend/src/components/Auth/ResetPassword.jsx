import React, { useState } from 'react';
import { resetPassword } from '../../services/auth';
import { isPasswordValid } from '../../utils/passwordRules';
import PasswordRequirements, { ValidationItem } from './PasswordRequirements';
import AuthLayout from './AuthLayout';
import { FormAlert, PasswordField, SubmitButton } from './FormField';

const ResetPassword = ({ token, onSuccess, onRequestNewLink, onBackToLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid(password)) { setError('Password does not meet all requirements.'); return; }
    if (!passwordsMatch) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await resetPassword(token, password);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Could not reset your password. Please try again.');
      // Only an expired / used / unknown link is unrecoverable; validation errors can be corrected in place
      if (/invalid or has expired/i.test(err.message || '')) setLinkInvalid(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="You'll be signed out on all other devices."
      footer={<button type="button" className="auth-link" onClick={onBackToLogin}>Back to login</button>}
    >
      <FormAlert>{error}</FormAlert>
      {linkInvalid ? (
        <button type="button" className="btn-primary" onClick={onRequestNewLink}>Request a new link</button>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <PasswordField id="reset-password" label="New password" placeholder="Create a password" autoComplete="new-password" autoFocus value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}>
            {password && <PasswordRequirements password={password} />}
          </PasswordField>
          <PasswordField id="reset-confirm-password" label="Confirm new password" placeholder="Re-enter your password" autoComplete="new-password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}>
            {confirmPassword && <div style={{ marginTop: '8px' }}><ValidationItem label="Passwords match" isValid={!!passwordsMatch} /></div>}
          </PasswordField>
          <SubmitButton loading={loading} loadingText="Saving…">Reset password</SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;

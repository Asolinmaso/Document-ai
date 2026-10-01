import React, { useState } from 'react';
import { signup, login } from '../../services/auth';
import { isValidEmail, isValidName, isPasswordValid } from '../../utils/passwordRules';
import PasswordRequirements, { ValidationItem } from './PasswordRequirements';
import AuthLayout from './AuthLayout';
import { FormAlert, FormField, PasswordField, SubmitButton } from './FormField';

const validate = ({ name, email, password, confirmPassword }) => ({
  name: !name.trim() ? 'Enter your full name.' : !isValidName(name) ? 'Your name must be between 2 and 100 characters.' : '',
  email: !email.trim() ? 'Enter your email address.' : !isValidEmail(email) ? 'Enter a valid email address.' : '',
  password: !password ? 'Create a password.' : !isPasswordValid(password) ? 'Password does not meet all requirements.' : '',
  confirmPassword: !confirmPassword ? 'Confirm your password.' : confirmPassword !== password ? 'Passwords do not match.' : '',
});

const Signup = ({ onLoginClick, onSignupSuccess }) => {
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const errors = validate(values);
  const shown = (field) => (touched[field] ? errors[field] : '');
  const bind = (field) => ({
    value: values[field],
    onChange: (e) => { setValues((v) => ({ ...v, [field]: e.target.value })); setError(''); },
    onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
  });

  const passwordsMatch = Boolean(values.password) && values.password === values.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    if (Object.values(errors).some(Boolean)) return;

    setError('');
    setLoading(true);
    let created = false;
    try {
      await signup(values.name.trim(), values.email.trim(), values.password);
      created = true;
      const data = await login(values.email.trim(), values.password);
      onSignupSuccess(data.user);
    } catch (err) {
      if (created) {
        // The account exists; only the automatic sign-in failed, so don't tell the user signup failed
        setError('Your account was created, but we could not sign you in automatically. Please log in.');
        setTimeout(onLoginClick, 2500);
      } else {
        setError(err.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join DocAI and automate your documentation."
      footer={<>Already have an account? <button type="button" className="auth-link" onClick={onLoginClick}>Sign in</button></>}
    >
      <FormAlert>{error}</FormAlert>
      <form onSubmit={handleSubmit} noValidate>
        <FormField id="signup-name" label="Full name" placeholder="Jane Doe" autoComplete="name" autoFocus error={shown('name')} {...bind('name')} />
        <FormField id="signup-email" label="Email address" type="email" placeholder="you@company.com" autoComplete="email" error={shown('email')} {...bind('email')} />
        <PasswordField id="signup-password" label="Password" placeholder="Create a password" autoComplete="new-password" error={shown('password')} {...bind('password')}>
          {values.password && <PasswordRequirements password={values.password} />}
        </PasswordField>
        <PasswordField id="signup-confirm-password" label="Confirm password" placeholder="Re-enter your password" autoComplete="new-password" error={shown('confirmPassword')} {...bind('confirmPassword')}>
          {values.confirmPassword && !shown('confirmPassword') && (
            <div style={{ marginTop: '8px' }}><ValidationItem label="Passwords match" isValid={passwordsMatch} /></div>
          )}
        </PasswordField>
        <SubmitButton loading={loading} loadingText="Creating account…">Create account</SubmitButton>
      </form>
    </AuthLayout>
  );
};

export default Signup;

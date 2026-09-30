import React, { useState } from 'react';
import { login } from '../../services/auth';
import { isValidEmail } from '../../utils/passwordRules';
import AuthLayout from './AuthLayout';
import { FormAlert, FormField, PasswordField, SubmitButton } from './FormField';

const validate = ({ email, password }) => ({
  email: !email.trim() ? 'Enter your email address.' : !isValidEmail(email) ? 'Enter a valid email address.' : '',
  password: !password ? 'Enter your password.' : '',
});

const Login = ({ onSignupClick, onForgotClick, onLoginSuccess }) => {
  const [values, setValues] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const errors = validate(values);
  const shown = (field) => (touched[field] ? errors[field] : '');
  const bind = (field) => ({
    value: values[field],
    onChange: (e) => { setValues((v) => ({ ...v, [field]: e.target.value })); setError(''); },
    onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (errors.email || errors.password) return;

    setError('');
    setLoading(true);
    try {
      const data = await login(values.email.trim(), values.password);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your DocAI account to continue."
      footer={<>Don't have an account? <button type="button" className="auth-link" onClick={onSignupClick}>Create account</button></>}
    >
      <FormAlert>{error}</FormAlert>
      <form onSubmit={handleSubmit} noValidate>
        <FormField id="login-email" label="Email address" type="email" placeholder="you@company.com" autoComplete="email" autoFocus error={shown('email')} {...bind('email')} />
        <PasswordField
          id="login-password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          error={shown('password')}
          action={<button type="button" className="auth-link" style={{ fontSize: '13px' }} onClick={() => onForgotClick(values.email.trim())}>Forgot password?</button>}
          {...bind('password')}
        />
        <SubmitButton loading={loading} loadingText="Signing in…">Sign in</SubmitButton>
      </form>
    </AuthLayout>
  );
};

export default Login;

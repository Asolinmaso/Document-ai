import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export const FormAlert = ({ children }) =>
  children ? (
    <div className="auth-alert" role="alert">
      <AlertCircle size={16} />
      <span>{children}</span>
    </div>
  ) : null;

// Always rendered (its height is reserved in CSS): a message appearing on blur must not move the buttons
// below it, or the click that caused the blur misses its target.
const FieldError = ({ id, error }) => (
  <div className="field-error" id={`${id}-error`} role={error ? 'alert' : undefined}>
    {error && <><AlertCircle size={13} />{error}</>}
  </div>
);

/** Labelled input with an inline validation message. `action` renders on the label row (e.g. "Forgot password?"). */
export const FormField = ({ id, label, error, action, type = 'text', ...inputProps }) => (
  <div className="form-group">
    <div className="field-label-row">
      <label className="field-label" htmlFor={id}>{label}</label>
      {action}
    </div>
    <input
      id={id}
      type={type}
      className={`form-control${error ? ' is-invalid' : ''}`}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      {...inputProps}
    />
    <FieldError id={id} error={error} />
  </div>
);

/** FormField for passwords with a show/hide toggle. Children render under the input (rules checklist etc.). */
export const PasswordField = ({ id, label, error, action, children, ...inputProps }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="form-group">
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>{label}</label>
        {action}
      </div>
      <div className="input-wrapper">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={`form-control has-toggle${error ? ' is-invalid' : ''}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...inputProps}
        />
        <button type="button" className="input-toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <FieldError id={id} error={error} />
      {children}
    </div>
  );
};

export const SubmitButton = ({ loading, loadingText, children, ...rest }) => (
  <button type="submit" className="btn-primary" disabled={loading} {...rest}>
    {loading ? <><span className="btn-spinner" />{loadingText}</> : children}
  </button>
);

import React from 'react';
import { Check, X } from 'lucide-react';
import { checkPassword } from '../../utils/passwordRules';

export const ValidationItem = ({ label, isValid }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isValid ? '#16A34A' : '#9CA3AF' }}>
    {isValid ? <Check size={13} /> : <X size={13} />}
    <span>{label}</span>
  </div>
);

/** Live checklist for the password rules (shared by sign-up and reset-password). */
const PasswordRequirements = ({ password }) => {
  const rules = checkPassword(password);
  return (
    <div className="password-rules">
      <ValidationItem label="8+ characters" isValid={rules.minLength} />
      <ValidationItem label="1 uppercase letter" isValid={rules.uppercase} />
      <ValidationItem label="1 special character" isValid={rules.special} />
      {!rules.maxLength && <ValidationItem label="At most 72 characters" isValid={false} />}
    </div>
  );
};

export default PasswordRequirements;

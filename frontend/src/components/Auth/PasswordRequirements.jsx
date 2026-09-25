import React from 'react';
import { Check, X } from 'lucide-react';
import { checkPassword } from '../../utils/passwordRules';

export const ValidationItem = ({ label, isValid }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isValid ? '#34D399' : 'rgba(255,255,255,0.4)' }}>
    {isValid ? <Check size={12} /> : <X size={12} />}
    <span>{label}</span>
  </div>
);

/** Live checklist for the password rules (shared by sign-up and reset-password). */
const PasswordRequirements = ({ password }) => {
  const rules = checkPassword(password);
  return (
    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <ValidationItem label="At least 8 characters" isValid={rules.minLength} />
      <ValidationItem label="At least 1 uppercase letter" isValid={rules.uppercase} />
      <ValidationItem label="At least 1 special character" isValid={rules.special} />
      {!rules.maxLength && <ValidationItem label="At most 72 characters" isValid={false} />}
    </div>
  );
};

export default PasswordRequirements;

// Mirrors backend/authHelpers.js – the server is the source of truth, this gives earlier feedback.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (email) =>
  typeof email === 'string' && email.trim().length <= 254 && EMAIL_RE.test(email.trim());

export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const isValidName = (name) => {
  const len = name.trim().replace(/\s+/g, ' ').length;
  return len >= NAME_MIN && len <= NAME_MAX;
};

/** Which password requirements are met. bcrypt only reads 72 bytes, so longer passwords are refused. */
export const checkPassword = (password) => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  special: /[^A-Za-z0-9\s]/.test(password),
  maxLength: new TextEncoder().encode(password).length <= 72,
});

export const isPasswordValid = (password) => Object.values(checkPassword(password)).every(Boolean);

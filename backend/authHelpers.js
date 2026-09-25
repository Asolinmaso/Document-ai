import crypto from 'crypto';
import nodemailer from 'nodemailer';

/* ── Validation ───────────────────────────────────────────────────────────────
 * These rules are mirrored in frontend/src/utils/passwordRules.js – keep them in sync.
 * The server is the source of truth; the frontend only gives earlier feedback.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Returns the trimmed, lower-cased email, or null when it is missing / not a valid address. */
export const normalizeEmail = (email) => {
  if (typeof email !== 'string') return null;
  const value = email.trim().toLowerCase();
  return value.length <= 254 && EMAIL_RE.test(value) ? value : null;
};

/** Returns the trimmed name, or null when it is missing or out of range. */
export const normalizeName = (name) => {
  if (typeof name !== 'string') return null;
  const value = name.trim().replace(/\s+/g, ' ');
  return value.length >= 2 && value.length <= 100 ? value : null;
};

/** Returns an error message, or null when the password is acceptable. */
export const validatePassword = (password) => {
  if (typeof password !== 'string' || !password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  // bcrypt only uses the first 72 bytes; refuse longer input instead of silently truncating it
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be at most 72 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[^A-Za-z0-9\s]/.test(password)) return 'Password must contain at least one special character.';
  return null;
};

/* ── Reset tokens ─────────────────────────────────────────────────────────────
 * The raw token only ever exists in the email link; the database stores its SHA-256 hash.
 */

export const generateResetToken = () => crypto.randomBytes(32).toString('hex');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const isWellFormedToken = (token) => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

/* ── Email ────────────────────────────────────────────────────────────────── */

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let transporter = null;
const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

/**
 * Sends a transactional email. Without SMTP settings it prints the message to the server log in
 * development (so the reset flow can be tried locally) and fails loudly in production.
 */
export const sendTransactionalMail = async ({ to, subject, html, text }) => {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS).');
    }
    console.log(`\n[dev mail] to=${to}\n[dev mail] subject=${subject}\n[dev mail] ${text}\n`);
    return { logged: true };
  }
  return getTransporter().sendMail({
    from: process.env.EMAIL_FROM || `"DocAI" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

export const sendPasswordResetEmail = ({ to, name, link, expiresInMinutes }) =>
  sendTransactionalMail({
    to,
    subject: 'Reset your DocAI password',
    text: `Hi ${name},\n\nWe received a request to reset your DocAI password. Open this link to choose a new one (valid for ${expiresInMinutes} minutes):\n\n${link}\n\nIf you didn't ask for this, you can ignore this email – your password will stay the same.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111827">
        <h2 style="margin:0 0 12px">Reset your password</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>We received a request to reset your DocAI password. This link is valid for ${expiresInMinutes} minutes.</p>
        <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#6C2BD9;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Choose a new password</a></p>
        <p style="font-size:12px;color:#6B7280">If the button doesn't work, paste this link into your browser:<br>${escapeHtml(link)}</p>
        <p style="font-size:12px;color:#6B7280">If you didn't ask for this, you can ignore this email – your password will stay the same.</p>
      </div>`,
  });

export const sendPasswordChangedEmail = ({ to, name }) =>
  sendTransactionalMail({
    to,
    subject: 'Your DocAI password was changed',
    text: `Hi ${name},\n\nYour DocAI password was just changed. If this wasn't you, reset your password again right away.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#111827"><p>Hi ${escapeHtml(name)},</p><p>Your DocAI password was just changed. If this wasn't you, reset your password again right away.</p></div>`,
  });

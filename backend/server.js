import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import pool, { initSchema } from './db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import Groq from 'groq-sdk';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  normalizeEmail,
  normalizeName,
  validatePassword,
  generateResetToken,
  hashToken,
  isWellFormedToken,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} from './authHelpers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Behind Render / Vercel / nginx the client IP arrives in X-Forwarded-For. Without this every user
// shares the proxy's IP and the rate limiter below would throttle everyone together.
// Override with TRUST_PROXY (number of proxy hops, or "false").
const trustProxyEnv = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxyEnv !== undefined ? (trustProxyEnv === 'false' ? false : Number(trustProxyEnv) || trustProxyEnv) : (process.env.NODE_ENV === 'production' ? 1 : false));

// --- MIDDLEWARE ---

// FRONTEND_URL may hold several comma-separated origins. Trailing slashes are ignored because
// browsers send the Origin header without one ("https://app.vercel.app", not ".../").
const normalizeOrigin = (url) => url.trim().replace(/\/+$/, '');
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';
const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(cors({
  origin(origin, callback) {
    // No Origin header: same-origin requests, curl, server-to-server calls
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
    if (!isProduction && isLocalOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Rate limiting. Limits apply per route so that ordinary calls such as /auth/me (made on every page
// load) are never counted against the strict login / signup / password-reset budgets.
const limiter = ({ windowMs = 15 * 60 * 1000, max, message, ...rest }) =>
  rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: message }, ...rest });

const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';
const apiLimiter = limiter({ max: 300, message: 'Too many requests. Please slow down and try again shortly.' });
const loginLimiter = limiter({ max: 20, message: TOO_MANY, skipSuccessfulRequests: true }); // only failed logins count
const signupLimiter = limiter({ max: 15, message: TOO_MANY });
const forgotLimiter = limiter({ max: 5, message: TOO_MANY });
const resetLimiter = limiter({ max: 10, message: TOO_MANY });

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/signup', signupLimiter);
app.use('/api/auth/forgot-password', forgotLimiter);
app.use('/api/auth/reset-password', resetLimiter);

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- AUTH MIDDLEWARE ---

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your_jwt_secret_key_here') {
    console.error('CRITICAL: JWT_SECRET is not properly configured!');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  jwt.verify(token, secret, async (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Invalid or malformed token. Please log in again.', code: 'TOKEN_INVALID' });
    }

    try {
      // The account must still exist, and the token must have been issued after the last password change
      const account = await pool.query('SELECT password_changed_at FROM users WHERE id = $1', [user.id]);
      if (account.rowCount === 0) {
        return res.status(401).json({ error: 'Account no longer exists. Please log in again.', code: 'TOKEN_INVALID' });
      }
      const changedAt = account.rows[0].password_changed_at;
      if (changedAt && user.iat < Math.floor(new Date(changedAt).getTime() / 1000)) {
        return res.status(401).json({ error: 'Your password was changed. Please log in again.', code: 'TOKEN_INVALID' });
      }
    } catch (dbError) {
      console.error('Auth check failed:', dbError);
      return res.status(500).json({ error: 'Could not verify your session. Please try again.' });
    }

    req.user = user;
    next();
  });
};

// --- ROOT ROUTE ---

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'DocAI Backend is running.', version: '1.0.0' });
});

// Lets the frontend (and hosting platforms) check that the API and database are reachable
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

// --- AUTHENTICATION ROUTES ---

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps login timing equal for unknown emails
const RESET_TOKEN_MINUTES = 60;
const RESET_COOLDOWN_SECONDS = 60;

// Where the reset link should point: the frontend the request came from (if allowed), else FRONTEND_URL
const frontendBaseFor = (req) => {
  const origin = req.headers.origin && normalizeOrigin(req.headers.origin);
  if (origin && (allowedOrigins.includes(origin) || (!isProduction && isLocalOrigin(origin)))) return origin;
  return allowedOrigins[0];
};

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    const cleanName = normalizeName(name);
    if (!cleanName) return res.status(400).json({ error: 'Please enter your full name (2–100 characters).' });

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return res.status(400).json({ error: 'Please provide a valid email address.' });

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (userCheck.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [cleanName, cleanEmail, hashedPassword]
    );

    res.status(201).json({ message: 'Account created successfully.', user: result.rows[0] });
  } catch (error) {
    // Two signups for the same email racing past the check above
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ error: 'Email is required.' });
    if (typeof password !== 'string' || !password) return res.status(400).json({ error: 'Password is required.' });
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return res.status(400).json({ error: 'Please provide a valid email address.' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    const user = result.rows[0];

    // Always run a bcrypt comparison so response time doesn't reveal whether the email exists
    const validPassword = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'your_jwt_secret_key_here') {
      console.error('CRITICAL: JWT_SECRET is not properly configured!');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      secret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Step 1 of "forgot password": email a single-use link. The response is identical whether or not the
// account exists, so this endpoint can't be used to discover which emails are registered.
app.post('/api/auth/forgot-password', async (req, res) => {
  const generic = { message: 'If an account exists for that email, a password reset link is on its way.' };
  try {
    const cleanEmail = normalizeEmail(req.body?.email);
    if (!cleanEmail) return res.status(400).json({ error: 'Please provide a valid email address.' });

    const found = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [cleanEmail]);
    if (found.rowCount > 0) {
      const user = found.rows[0];

      const recent = await pool.query(
        `SELECT 1 FROM password_resets
         WHERE user_id = $1 AND used_at IS NULL AND created_at > NOW() - make_interval(secs => $2)`,
        [user.id, RESET_COOLDOWN_SECONDS]
      );

      if (recent.rowCount === 0) {
        const token = generateResetToken();
        await pool.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]); // older links stop working
        await pool.query(
          `INSERT INTO password_resets (user_id, token_hash, expires_at)
           VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
          [user.id, hashToken(token), RESET_TOKEN_MINUTES]
        );

        const link = `${frontendBaseFor(req)}/?reset_token=${token}`;
        // Not awaited: sending takes a while and would make "account exists" observable through timing
        sendPasswordResetEmail({ to: user.email, name: user.name, link, expiresInMinutes: RESET_TOKEN_MINUTES })
          .catch((err) => console.error('Failed to send password reset email:', err.message));
      }
    }
    res.json(generic);
  } catch (error) {
    console.error('Forgot-password error:', error);
    res.status(500).json({ error: 'Could not process the request. Please try again.' });
  }
});

// Step 2: set the new password using the emailed token
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  const invalidLink = { error: 'This reset link is invalid or has expired. Please request a new one.' };

  if (!isWellFormedToken(token)) return res.status(400).json(invalidLink);
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT pr.user_id, u.name, u.email
       FROM password_resets pr JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > NOW()
       FOR UPDATE OF pr`,
      [hashToken(token)]
    );
    if (found.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(invalidLink);
    }
    const { user_id: userId, name, email } = found.rows[0];

    const hashedPassword = await bcrypt.hash(password, 12);
    // password_changed_at signs out every session that was created before this moment
    await client.query('UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2', [hashedPassword, userId]);
    await client.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
    await client.query('COMMIT');

    sendPasswordChangedEmail({ to: email, name })
      .catch((err) => console.error('Failed to send password-changed notice:', err.message));
    res.json({ message: 'Your password has been reset. You can now log in with it.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Reset-password error:', error);
    res.status(500).json({ error: 'Could not reset your password. Please try again.' });
  } finally {
    client.release();
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Auth /me error:', error);
    res.status(500).json({ error: 'Failed to fetch user data.' });
  }
});

// --- PROFILE ROUTES ---

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profile WHERE id = 1');
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Failed to read profile:', error);
    res.status(500).json({ error: 'Failed to read profile.' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const allowedFields = {
      companyName: '"companyName"',
      businessType: '"businessType"',
      industry: 'industry',
      website: 'website',
      contact: 'contact',
      email: 'email',
      address: 'address',
      city: 'city',
      state: 'state',
      country: 'country',
      postalCode: '"postalCode"',
    };

    const fields = [];
    const values = [];
    let valIdx = 1;

    for (const [key, columnName] of Object.entries(allowedFields)) {
      if (req.body[key] !== undefined) {
        fields.push(`${columnName} = $${valIdx}`);
        values.push(req.body[key]);
        valIdx++;
      }
    }

    if (fields.length > 0) {
      values.push(1);
      const query = `UPDATE profile SET ${fields.join(', ')} WHERE id = $${valIdx} RETURNING *`;
      const result = await pool.query(query, values);
      res.json(result.rows[0]);
    } else {
      const result = await pool.query('SELECT * FROM profile WHERE id = 1');
      res.json(result.rows[0] || {});
    }
  } catch (error) {
    console.error('Failed to update profile:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// --- LOGOS ROUTES ---

app.get('/api/logos', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM logos ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to read logos:', error);
    res.status(500).json({ error: 'Failed to read logos.' });
  }
});

app.post('/api/logos', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM logos');

    const logos = Array.isArray(req.body) ? req.body : [];
    for (const logo of logos) {
      await client.query(
        'INSERT INTO logos (id, name, url) VALUES ($1, $2, $3)',
        [logo.id || Date.now(), logo.name || '', logo.url || '']
      );
    }

    await client.query('COMMIT');
    res.json(logos);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to update logos:', error);
    res.status(500).json({ error: 'Failed to update logos.' });
  } finally {
    client.release();
  }
});

// --- DOCUMENTS ROUTES ---

app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to read documents:', error);
    res.status(500).json({ error: 'Failed to read documents.' });
  }
});

app.post('/api/documents', authenticateToken, async (req, res) => {
  try {
    const { name, type, edited, file } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Document name is required.' });

    const id = Date.now();
    const status = 'active';

    const result = await pool.query(
      'INSERT INTO documents (id, name, type, edited, file, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, name.trim(), type || '', edited || new Date().toLocaleDateString(), file || '', status]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to add document:', error);
    res.status(500).json({ error: 'Failed to add document.' });
  }
});

app.put('/api/documents/:id', authenticateToken, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    if (isNaN(docId)) return res.status(400).json({ error: 'Invalid document ID.' });

    const allowedFields = ['name', 'type', 'edited', 'file', 'status'];
    const fields = [];
    const values = [];
    let valIdx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${valIdx}`);
        values.push(req.body[field]);
        valIdx++;
      }
    }

    if (fields.length === 0) {
      const getRes = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);
      return getRes.rowCount > 0
        ? res.json(getRes.rows[0])
        : res.status(404).json({ error: 'Document not found.' });
    }

    values.push(docId);
    const query = `UPDATE documents SET ${fields.join(', ')} WHERE id = $${valIdx} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rowCount > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Document not found.' });
    }
  } catch (error) {
    console.error('Failed to update document:', error);
    res.status(500).json({ error: 'Failed to update document.' });
  }
});

app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    if (isNaN(docId)) return res.status(400).json({ error: 'Invalid document ID.' });

    const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [docId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    res.json({ success: true, id: docId });
  } catch (error) {
    console.error('Failed to delete document:', error);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

// --- GROQ EXTRACTION ROUTES ---

app.post('/api/extract', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { docId } = req.body;
    const filePath = path.join(process.cwd(), req.file.path);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    if (!mimeType.startsWith('image/')) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Only image files (PNG, JPG, JPEG) are supported for extraction.' });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract meaningful structured data from this document. Provide the output as a clean JSON object containing fields like "document_type", "company_name", "date", "key_values", and "summary". Return only raw JSON without any markdown code block syntax.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Data}` },
            },
          ],
        },
      ],
      model: 'llama-3.2-90b-vision-preview',
    });

    const content = chatCompletion.choices[0]?.message?.content || '{}';

    let parsedData = {};
    try {
      const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      parsedData = { raw_content: content };
    }

    const extRes = await pool.query(
      'INSERT INTO extractions (document_id, extracted_data, model_used) VALUES ($1, $2, $3) RETURNING *',
      [docId || null, JSON.stringify(parsedData), 'llama-3.2-90b-vision-preview']
    );

    if (docId) {
      await pool.query(
        'UPDATE documents SET extracted = true, extraction_id = $1 WHERE id = $2',
        [extRes.rows[0].id, docId]
      );
    }

    fs.unlinkSync(filePath);
    res.json(extRes.rows[0]);
  } catch (error) {
    console.error('Extraction error:', error);
    if (req.file) {
      try { fs.unlinkSync(path.join(process.cwd(), req.file.path)); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to extract data. Please try again.' });
  }
});

// --- MAIL ROUTES ---

// Get all emails
app.get('/api/mail', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mail ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails.' });
  }
});

// Save an email (sent, draft, scheduled)
app.post('/api/mail', authenticateToken, async (req, res) => {
  try {
    const { id, folder, sender, recipient, subject, snippet, body, time, attachments } = req.body;
    const attsStr = Array.isArray(attachments) ? JSON.stringify(attachments) : '[]';
    const mailId = id || Date.now();
    const result = await pool.query(
      'INSERT INTO mail (id, folder, sender, recipient, subject, snippet, body, time, attachments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [mailId, folder || 'Inbox', sender || '', recipient || '', subject || '', snippet || '', body || '', time || '', attsStr]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to save email:', error);
    res.status(500).json({ error: 'Failed to save email.' });
  }
});

// Update email folder (e.g., move to trash, restore)
app.put('/api/mail/:id', authenticateToken, async (req, res) => {
  try {
    const mailId = req.params.id;
    const { folder } = req.body;
    if (!folder) return res.status(400).json({ error: 'Folder is required.' });

    const result = await pool.query(
      'UPDATE mail SET folder = $1 WHERE id = $2 RETURNING *',
      [folder, mailId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Email not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update email:', error);
    res.status(500).json({ error: 'Failed to update email.' });
  }
});

// Delete email permanently
app.delete('/api/mail/:id', authenticateToken, async (req, res) => {
  try {
    const mailId = req.params.id;
    await pool.query('DELETE FROM mail WHERE id = $1', [mailId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete email:', error);
    res.status(500).json({ error: 'Failed to delete email.' });
  }
});

// Sync emails via IMAP
app.get('/api/mail/sync', authenticateToken, async (req, res) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(400).json({ error: 'Email credentials not configured. Please add SMTP_USER and SMTP_PASS to your .env file.' });
  }

  let client;
  try {
    client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      logger: false,
    });

    await client.connect();

    let lock = await client.getMailboxLock('INBOX');
    const fetchedEmails = [];

    try {
      const status = await client.status('INBOX', { messages: true });
      const totalMessages = status.messages;

      if (totalMessages > 0) {
        const start = Math.max(1, totalMessages - 14);
        const sequence = `${start}:*`;

        for await (let message of client.fetch(sequence, { source: true, uid: true })) {
          const parsed = await simpleParser(message.source);

          const uid = message.uid.toString();
          const subject = parsed.subject || '(No Subject)';
          const sender = parsed.from?.value[0]?.address || parsed.from?.text || 'Unknown';
          const recipient = parsed.to?.value[0]?.address || parsed.to?.text || '';
          const body = parsed.html || parsed.textAsHtml || parsed.text || '';
          const snippet = (parsed.text || '').substring(0, 100).replace(/\s+/g, ' ');
          const time = parsed.date
            ? parsed.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          let parsedAtts = [];
          if (parsed.attachments && parsed.attachments.length > 0) {
            parsedAtts = parsed.attachments.map((att) => ({
              name: att.filename || 'attachment',
              contentType: att.contentType,
              content: att.content ? att.content.toString('base64') : '',
            }));
          }

          fetchedEmails.push({ uid, subject, sender, recipient, body, snippet, time, attachments: parsedAtts });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    let newCount = 0;
    for (const email of fetchedEmails) {
      const exists = await pool.query('SELECT id FROM mail WHERE message_id = $1', [email.uid]);
      if (exists.rowCount === 0) {
        await pool.query(
          'INSERT INTO mail (id, folder, sender, recipient, subject, snippet, body, time, message_id, attachments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [
            Date.now() + Math.floor(Math.random() * 10000),
            'Inbox',
            email.sender,
            email.recipient,
            email.subject,
            email.snippet,
            email.body,
            email.time,
            email.uid,
            JSON.stringify(email.attachments),
          ]
        );
        newCount++;
      }
    }

    res.json({ success: true, synced: newCount, total: fetchedEmails.length });
  } catch (error) {
    console.error('Failed to sync emails via IMAP:', error);
    if (client) {
      try { await client.logout(); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to sync emails. Please ensure IMAP is enabled in your Gmail settings and your App Password is correct.' });
  }
});

// Send email
app.post('/api/mail/send', authenticateToken, async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, attachments } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient (to) is required.' });

    let transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      console.log('No SMTP credentials found in .env. Using Ethereal (test SMTP)...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"DocAI" <${process.env.SMTP_USER || 'no-reply@docai.app'}>`,
      to,
      cc,
      bcc,
      subject,
      html: body,
    };

    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map((att) => ({
        filename: att.name,
        content: att.content.split('base64,')[1] || att.content,
        encoding: 'base64',
      }));
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent:', info.messageId);

    let previewUrl = null;
    if (!process.env.SMTP_HOST) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log('Preview URL:', previewUrl);
    }

    res.json({ success: true, messageId: info.messageId, previewUrl });
  } catch (error) {
    console.error('Failed to send email:', error);
    res.status(500).json({ error: 'Failed to send email. Please check your SMTP configuration.' });
  }
});

// --- START SERVER ---

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ DocAI Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database setup failed. Server not started.', err);
    const host = err?.hostname || process.env.PGHOST || '';
    if (err?.code === 'ENOTFOUND' && /^dpg-[a-z0-9]+-a$/i.test(host)) {
      console.error(
        `\n💡 "${host}" is a Render *internal* hostname; it only resolves inside Render's network.\n` +
        '   To run locally, use the "External Database URL" from the Render dashboard, e.g.\n' +
        '   DATABASE_URL=postgres://user:password@dpg-xxxx-a.<region>-postgres.render.com/dbname\n' +
        '   (or point PGHOST/PGUSER/... at a local PostgreSQL).\n'
      );
    }
    process.exit(1);
  });

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigin : '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Rate limiting – stricter on auth endpoints
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

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

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Invalid or malformed token. Please log in again.', code: 'TOKEN_INVALID' });
    }
    req.user = user;
    next();
  });
};

// --- ROOT ROUTE ---

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'DocAI Backend is running.', version: '1.0.0' });
});

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required.' });
    if (!password) return res.status(400).json({ error: 'Password is required.' });

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userCheck.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name.trim(), email.toLowerCase().trim(), hashedPassword]
    );

    res.status(201).json({ message: 'Account created successfully.', user: result.rows[0] });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required.' });
    if (!password) return res.status(400).json({ error: 'Password is required.' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
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
    process.exit(1);
  });

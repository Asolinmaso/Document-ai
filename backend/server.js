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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? allowedOrigin : '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static('uploads'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', apiLimiter);

const upload = multer({ dest: 'uploads/' });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- ROOT ROUTE ---

app.get('/', (req, res) => {
  res.send('Backend is running successfully! Access the API at /api/profile, /api/documents, etc.');
});

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rowCount > 0) return res.status(400).json({ error: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) return res.status(400).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- PROFILE ROUTES ---

app.get('/api/profile', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM profile WHERE id = 1');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to read profile:', error);
    res.status(500).json({ error: 'Failed to read profile' });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const fields = [];
    const values = [];
    let valIdx = 1;
    
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
      postalCode: '"postalCode"'
    };

    for (const [key, columnName] of Object.entries(allowedFields)) {
      if (req.body[key] !== undefined) {
        fields.push(`${columnName} = $${valIdx}`);
        values.push(req.body[key]);
        valIdx++;
      }
    }

    if (fields.length > 0) {
      values.push(1); // for WHERE id = 1
      const query = `UPDATE profile SET ${fields.join(', ')} WHERE id = $${valIdx} RETURNING *`;
      const result = await pool.query(query, values);
      res.json(result.rows[0]);
    } else {
      const result = await pool.query('SELECT * FROM profile WHERE id = 1');
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Failed to update profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// --- LOGOS ROUTES ---

app.get('/api/logos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM logos ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to read logos:', error);
    res.status(500).json({ error: 'Failed to read logos' });
  }
});

app.post('/api/logos', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to update logos' });
  } finally {
    client.release();
  }
});

// --- DOCUMENTS ROUTES ---

app.get('/api/documents', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents ORDER BY id DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to read documents:', error);
    res.status(500).json({ error: 'Failed to read documents' });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const { name, type, edited, file } = req.body;
    const id = Date.now();
    const status = 'active';
    
    const result = await pool.query(
      'INSERT INTO documents (id, name, type, edited, file, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, name || '', type || '', edited || '', file || '', status]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to add document:', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

app.put('/api/documents/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    
    const fields = [];
    const values = [];
    let valIdx = 1;
    
    const allowedFields = ['name', 'type', 'edited', 'file', 'status'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${valIdx}`);
        values.push(req.body[field]);
        valIdx++;
      }
    }
    
    if (fields.length === 0) {
      const getRes = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);
      if (getRes.rowCount > 0) {
        return res.json(getRes.rows[0]);
      } else {
        return res.status(404).json({ error: 'Document not found' });
      }
    }
    
    values.push(docId);
    const query = `UPDATE documents SET ${fields.join(', ')} WHERE id = $${valIdx} RETURNING *`;
    const result = await pool.query(query, values);
    
    if (result.rowCount > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('Failed to update document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    await pool.query('DELETE FROM documents WHERE id = $1', [docId]);
    res.json({ success: true });

// --- GROQ EXTRACTION ROUTES ---

app.post('/api/extract', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { docId } = req.body;
    const filePath = path.join(process.cwd(), req.file.path);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    if (mimeType.startsWith('image/')) {
       const chatCompletion = await groq.chat.completions.create({
         messages: [
           {
             role: 'user',
             content: [
               { type: 'text', text: 'Extract meaningful structured data from this document. Provide the output as a clean JSON object containing fields like "document_type", "company_name", "date", "key_values", and "summary". Do not include markdown code block syntax around the JSON, just return raw JSON.' },
               { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
             ]
           }
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
         await pool.query('UPDATE documents SET extracted = true, extraction_id = $1 WHERE id = $2', [extRes.rows[0].id, docId]);
       }

       fs.unlinkSync(filePath);
       res.json(extRes.rows[0]);
    } else {
       fs.unlinkSync(filePath);
       return res.status(400).json({ error: 'Please upload an image (PNG, JPG, JPEG) for extraction.' });
    }
  } catch (error) {
    console.error('Extraction error:', error);
    if (req.file) {
       fs.unlinkSync(path.join(process.cwd(), req.file.path));
    }
    res.status(500).json({ error: 'Failed to extract data' });
  }
});

  } catch (error) {
    console.error('Failed to delete document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// --- MAIL ROUTES ---

// --- MAIL ROUTES ---

// Get all emails
app.get('/api/mail', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mail ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// Save an email (sent, draft, scheduled)
app.post('/api/mail', async (req, res) => {
  try {
    const { id, folder, sender, recipient, subject, snippet, body, time, attachments } = req.body;
    const attsStr = Array.isArray(attachments) ? JSON.stringify(attachments) : '[]';
    const result = await pool.query(
      'INSERT INTO mail (id, folder, sender, recipient, subject, snippet, body, time, attachments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [id, folder, sender || '', recipient || '', subject || '', snippet || '', body || '', time || '', attsStr]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to save email:', error);
    res.status(500).json({ error: 'Failed to save email' });
  }
});

// Sync emails via IMAP
app.get('/api/mail/sync', async (req, res) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(400).json({ error: 'Email credentials not configured in .env' });

// Update email folder (e.g., move to trash, restore)
app.put('/api/mail/:id', async (req, res) => {
  try {
    const mailId = req.params.id;
    const { folder } = req.body;
    const result = await pool.query(
      'UPDATE mail SET folder = $1 WHERE id = $2 RETURNING *',
      [folder, mailId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update email:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// Delete email permanently
app.delete('/api/mail/:id', async (req, res) => {
  try {
    const mailId = req.params.id;
    await pool.query('DELETE FROM mail WHERE id = $1', [mailId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete email:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

  }

  let client;
  try {
    client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      logger: false
    });

    await client.connect();
    
    let lock = await client.getMailboxLock('INBOX');
    const fetchedEmails = [];
    
    try {
      const status = await client.status('INBOX', { messages: true });
      const totalMessages = status.messages;
      
      if (totalMessages > 0) {
        // Fetch last 15 emails to be fast
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
          const time = parsed.date ? parsed.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          
          let parsedAtts = [];
          if (parsed.attachments && parsed.attachments.length > 0) {
            parsedAtts = parsed.attachments.map(att => ({
              name: att.filename || 'attachment',
              contentType: att.contentType,
              content: att.content ? att.content.toString('base64') : ''
            }));
          }
          
          fetchedEmails.push({ uid, subject, sender, recipient, body, snippet, time, attachments: parsedAtts });
        }
      }
    } finally {
      lock.release();
    }
    
    await client.logout();

    // Save to database
    let newCount = 0;
    for (const email of fetchedEmails) {
      const exists = await pool.query('SELECT id FROM mail WHERE message_id = $1', [email.uid]);
      if (exists.rowCount === 0) {
        await pool.query(
          'INSERT INTO mail (id, folder, sender, recipient, subject, snippet, body, time, message_id, attachments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [Date.now() + Math.floor(Math.random() * 10000), 'Inbox', email.sender, email.recipient, email.subject, email.snippet, email.body, email.time, email.uid, JSON.stringify(email.attachments)]
        );
        newCount++;
      }
    }

    res.json({ success: true, synced: newCount });
  } catch (error) {
    console.error('Failed to sync emails via IMAP:', error);
    if (client) {
      try { await client.logout(); } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to sync emails. Make sure IMAP is enabled in your Gmail settings.' });
  }
});

app.post('/api/mail/send', async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, attachments } = req.body;

    let transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      console.log('No SMTP credentials found in .env. Using Ethereal (fake SMTP) for testing...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, 
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"DocAI Mail Center" <no-reply@docai.test>',
      to,
      cc,
      bcc,
      subject,
      html: body,
    };

    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map(att => ({
        filename: att.name,
        content: att.content.split('base64,')[1] || att.content,
        encoding: 'base64'
      }));
    }

    const info = await transporter.sendMail(mailOptions);

    console.log("Message sent: %s", info.messageId);
    
    let previewUrl = false;
    if (!process.env.SMTP_HOST) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log("Preview URL: %s", previewUrl);
    }

    res.json({ success: true, messageId: info.messageId, previewUrl });
  } catch (error) {
    console.error('Failed to send email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Start Server after database schema has initialized
initSchema().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Database setup failed. Server not started.', err);
});

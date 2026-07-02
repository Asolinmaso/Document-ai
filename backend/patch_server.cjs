const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

// 1. Replace imports and setup
content = content.replace(/import express from 'express';[\s\S]*?\/\/ Middleware\napp\.use\(cors\(\)\);\napp\.use\(express\.json\(\{ limit: '50mb' \}\)\);\napp\.use\(express\.urlencoded\(\{ limit: '50mb', extended: true \}\)\);/, `import express from 'express';
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
};`);

// 2. Add auth endpoints before profile routes
content = content.replace(/\/\/ --- PROFILE ROUTES ---/, `// --- AUTHENTICATION ROUTES ---

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

// --- PROFILE ROUTES ---`);

// 3. Add Groq Extraction endpoint after documents DELETE route
content = content.replace(/app\.delete\('\/api\/documents\/:id', async \(req, res\) => \{[\s\S]*?\}\);/, `$&

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
               { type: 'image_url', image_url: { url: \`data:\${mimeType};base64,\${base64Data}\` } }
             ]
           }
         ],
         model: 'llama-3.2-90b-vision-preview',
       });
       
       const content = chatCompletion.choices[0]?.message?.content || '{}';
       
       let parsedData = {};
       try {
         const jsonStr = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
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
`);

// 4. Move /api/mail/sync above /api/mail/:id
// First, extract the sync route
const syncRouteMatch = content.match(/\/\/ Sync emails via IMAP\napp\.get\('\/api\/mail\/sync', async \(req, res\) => \{[\s\S]*?\}\);\n/);
if (syncRouteMatch) {
  content = content.replace(syncRouteMatch[0], ''); // Remove from original place
  
  // Insert it before app.put('/api/mail/:id')
  content = content.replace(/\/\/ Update email folder \(e\.g\., move to trash, restore\)\napp\.put\('\/api\/mail\/:id'/, syncRouteMatch[0] + '\n$&');
}

fs.writeFileSync('server.js', content);
console.log('server.js patched successfully!');

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbName = process.env.PGDATABASE || 'mabs_db';

// Ensure the database exists by connecting to default 'postgres' first
async function ensureDatabaseExists() {
  const { Client } = pg;
  const clientConfig = process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL.trim(),
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: (process.env.PGUSER || 'postgres').trim(),
        password: (process.env.PGPASSWORD || 'postgres').trim(),
        host: (process.env.PGHOST || 'localhost').trim(),
        port: parseInt(process.env.PGPORT || '5432'),
        database: 'postgres', // Note: this will likely fail on managed DBs if using DATABASE_URL, handled by try/catch
        ssl: process.env.PGHOST && process.env.PGHOST !== 'localhost' ? { rejectUnauthorized: false } : false
      };

  const client = new Client(clientConfig);
  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    }
  } catch (error) {
    console.error('Info/Error ensuring database exists:', error.message);
  } finally {
    try {
      await client.end();
    } catch (e) {
      // ignore client end failure
    }
  }
}

const pool = process.env.DATABASE_URL 
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL.trim(),
      ssl: { rejectUnauthorized: false }
    })
  : new pg.Pool({
      user: (process.env.PGUSER || 'postgres').trim(),
      password: (process.env.PGPASSWORD || 'postgres').trim(),
      host: (process.env.PGHOST || 'localhost').trim(),
      port: parseInt(process.env.PGPORT || '5432'),
      database: (process.env.PGDATABASE || 'mabs_db').trim(),
      ssl: process.env.PGHOST && process.env.PGHOST !== 'localhost' ? { rejectUnauthorized: false } : false
    });

// Automatic migration script from db.json
async function migrateDataFromJSON(client) {
  const docCountRes = await client.query('SELECT COUNT(*) FROM documents');
  const logoCountRes = await client.query('SELECT COUNT(*) FROM logos');
  const profileRes = await client.query('SELECT * FROM profile WHERE id = 1');

  const docCount = parseInt(docCountRes.rows[0].count);
  const logoCount = parseInt(logoCountRes.rows[0].count);
  
  // If the profile already has a company name or documents/logos are present, skip migration
  if (docCount > 0 || logoCount > 0 || (profileRes.rows[0] && profileRes.rows[0].companyName)) {
    console.log('PostgreSQL already contains data. Skipping initial JSON migration.');
    return;
  }

  const dbJsonPath = path.join(__dirname, 'db.json');
  try {
    await fs.access(dbJsonPath);
  } catch (e) {
    console.log('db.json not found in backend directory. Nothing to migrate.');
    return;
  }

  console.log('Database tables are empty, but db.json exists. Starting data migration...');

  try {
    const rawData = await fs.readFile(dbJsonPath, 'utf8');
    const data = JSON.parse(rawData);

    // 1. Migrate profile
    if (data.profile) {
      await client.query(`
        UPDATE profile SET
          "companyName" = $1,
          "businessType" = $2,
          industry = $3,
          website = $4,
          contact = $5,
          email = $6,
          address = $7,
          city = $8,
          state = $9,
          country = $10,
          "postalCode" = $11
        WHERE id = 1
      `, [
        data.profile.companyName || '',
        data.profile.businessType || '',
        data.profile.industry || '',
        data.profile.website || '',
        data.profile.contact || '',
        data.profile.email || '',
        data.profile.address || '',
        data.profile.city || '',
        data.profile.state || '',
        data.profile.country || '',
        data.profile.postalCode || ''
      ]);
      console.log('Profile details imported.');
    }

    // 2. Migrate logos
    if (Array.isArray(data.logos)) {
      for (const logo of data.logos) {
        await client.query(
          'INSERT INTO logos (id, name, url) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          [logo.id || Date.now(), logo.name || '', logo.url || '']
        );
      }
      console.log(`Imported ${data.logos.length} logos.`);
    }

    // 3. Migrate documents
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        await client.query(
          'INSERT INTO documents (id, name, type, edited, file, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [
            doc.id || Date.now(),
            doc.name || '',
            doc.type || '',
            doc.edited || '',
            doc.file || '',
            doc.status || 'active'
          ]
        );
      }
      console.log(`Imported ${data.documents.length} documents.`);
    }

    console.log('Automatic database migration completed successfully!');
  } catch (err) {
    console.error('Error during data migration:', err);
  }
}

// Initialise schemas
export async function initSchema() {
  await ensureDatabaseExists();

  const client = await pool.connect();
  try {
    // 1. Profile table
    await client.query(`
      CREATE TABLE IF NOT EXISTS profile (
        id SERIAL PRIMARY KEY,
        "companyName" VARCHAR(255) DEFAULT '',
        "businessType" VARCHAR(255) DEFAULT '',
        industry VARCHAR(255) DEFAULT '',
        website VARCHAR(255) DEFAULT '',
        contact VARCHAR(50) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        address TEXT DEFAULT '',
        city VARCHAR(100) DEFAULT '',
        state VARCHAR(100) DEFAULT '',
        country VARCHAR(100) DEFAULT '',
        "postalCode" VARCHAR(20) DEFAULT ''
      )
    `);

    // Ensure initial row id = 1 exists
    const profileCheck = await client.query('SELECT 1 FROM profile WHERE id = 1');
    if (profileCheck.rowCount === 0) {
      await client.query('INSERT INTO profile (id) VALUES (1)');
    }

    // 2. Logos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS logos (
        id BIGINT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL
      )
    `);

    // 3. Documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id BIGINT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        edited VARCHAR(100) DEFAULT '',
        file TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'active'
      )
    `);

    // 4. Mail table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mail (
        id BIGINT PRIMARY KEY,
        folder VARCHAR(50) NOT NULL DEFAULT 'Inbox',
        sender VARCHAR(255) NOT NULL DEFAULT '',
        recipient VARCHAR(255) NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        snippet TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        time VARCHAR(50) NOT NULL DEFAULT '',
        message_id VARCHAR(255) UNIQUE,
        attachments TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add message_id and attachments columns to existing mail table if they don't exist
    try { await client.query(`ALTER TABLE mail ADD COLUMN message_id VARCHAR(255) UNIQUE`); } catch (e) {}
    try { await client.query(`ALTER TABLE mail ADD COLUMN attachments TEXT DEFAULT '[]'`); } catch (e) {}

    // 5. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 6. Extractions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS extractions (
        id SERIAL PRIMARY KEY,
        document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
        extracted_data JSONB NOT NULL,
        model_used VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add extracted and extraction_id columns to existing documents table
    try { await client.query(`ALTER TABLE documents ADD COLUMN extracted BOOLEAN DEFAULT false`); } catch (e) {}
    try { await client.query(`ALTER TABLE documents ADD COLUMN extraction_id INTEGER REFERENCES extractions(id) ON DELETE SET NULL`); } catch (e) {}


    console.log('PostgreSQL schema structure verified.');
    
    // Check and migrate data
    await migrateDataFromJSON(client);
  } catch (error) {
    console.error('Database connection or schema setup failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;

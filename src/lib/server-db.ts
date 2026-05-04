import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server.sqlite');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    refresh_token TEXT,
    access_token TEXT,
    expiry_date INTEGER,
    gemini_api_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;

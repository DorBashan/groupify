import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const DB_PATH = process.env.DB_PATH || './groupify.db';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    playlist_data TEXT
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    spotify_id TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    country TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, spotify_id)
  );
`);

// Migrations — safe to run on every startup
try { db.exec(`ALTER TABLE members ADD COLUMN country TEXT`); } catch {}

export default db;

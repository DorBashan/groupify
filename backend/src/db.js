import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./groupify.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    playlist_data TEXT
  )
`);

await db.execute(`
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
  )
`);

try { await db.execute(`ALTER TABLE members ADD COLUMN country TEXT`); } catch {}

export default db;

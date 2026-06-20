import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'chat.db');
console.log('Database path:', dbPath);
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    password TEXT DEFAULT NULL,
    avatar TEXT DEFAULT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER NOT NULL,
    receiverId INTEGER NOT NULL,
    content TEXT DEFAULT NULL,
    imageUrl TEXT DEFAULT NULL,
    audioUrl TEXT DEFAULT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    read INTEGER DEFAULT 0,
    edited INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    repliedTo INTEGER DEFAULT NULL,
    reactions TEXT DEFAULT NULL,
    FOREIGN KEY (senderId) REFERENCES users(id),
    FOREIGN KEY (receiverId) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(senderId, receiverId);
  CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiverId, senderId);
  CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
`);

try { db.exec('ALTER TABLE users ADD COLUMN password TEXT DEFAULT NULL'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN audioUrl TEXT DEFAULT NULL'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN repliedTo INTEGER DEFAULT NULL'); } catch {}
try { db.exec('ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT NULL'); } catch {}

export default db;

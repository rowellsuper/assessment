import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'ajaia.db');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function closeDb() {
  db.close();
}

export function initDb() {
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled Document',
      content TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      shared_by TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'edit',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(document_id, user_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS document_comments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      quoted_text TEXT,
      suggestion TEXT,
      is_suggestion INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);
    CREATE INDEX IF NOT EXISTS idx_shares_document ON document_shares(document_id);
    CREATE INDEX IF NOT EXISTS idx_versions_document ON document_versions(document_id);
    CREATE INDEX IF NOT EXISTS idx_comments_document ON document_comments(document_id);
  `);

  migrateDb();
  seedUsers();
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}

function migrateDb() {
  const tableNames = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
      (t) => t.name
    )
  );

  if (tableNames.has('document_shares')) {
    const shareCols = db.prepare('PRAGMA table_info(document_shares)').all() as { name: string }[];
    if (!shareCols.some((c) => c.name === 'permission')) {
      db.exec("ALTER TABLE document_shares ADD COLUMN permission TEXT DEFAULT 'edit'");
      db.exec("UPDATE document_shares SET permission = 'edit' WHERE permission IS NULL");
    }
  }

  if (!tableNames.has('document_versions')) {
    db.exec(`
      CREATE TABLE document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_versions_document ON document_versions(document_id);
    `);
  }

  if (!tableNames.has('document_comments')) {
    db.exec(`
      CREATE TABLE document_comments (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        body TEXT NOT NULL,
        quoted_text TEXT,
        suggestion TEXT,
        is_suggestion INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_comments_document ON document_comments(document_id);
    `);
  }
}

function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (count.c > 0) return;

  const users = [
    { id: 'user-alice', email: 'alice@ajaia.test', name: 'Alice Chen', password: 'password123' },
    { id: 'user-bob', email: 'bob@ajaia.test', name: 'Bob Martinez', password: 'password123' },
    { id: 'user-carol', email: 'carol@ajaia.test', name: 'Carol Williams', password: 'password123' },
  ];

  const insert = db.prepare(
    'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)'
  );

  for (const user of users) {
    insert.run(user.id, user.email, user.name, bcrypt.hashSync(user.password, 10));
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentShare {
  id: string;
  document_id: string;
  user_id: string;
  shared_by: string;
  created_at: string;
}

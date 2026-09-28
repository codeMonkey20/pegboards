import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    color TEXT NOT NULL DEFAULT '#2a78d6',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#2a78d6',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#898781',
    position INTEGER NOT NULL DEFAULT 0,
    is_done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status_id INTEGER NOT NULL REFERENCES statuses(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    due_date TEXT,
    estimate_hours REAL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hours REAL NOT NULL CHECK (hours > 0),
    note TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_shared INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS widgets (
    id INTEGER PRIMARY KEY,
    dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    config TEXT NOT NULL,
    width TEXT NOT NULL DEFAULT 'third',
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, status_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON widgets(dashboard_id, position);
`;

/**
 * Brings databases created by older versions up to the current schema.
 * `CREATE TABLE IF NOT EXISTS` doesn't add columns to existing tables.
 *
 * @param {DatabaseSync} db
 * @returns {void}
 */
function migrate(db) {
    const timeEntryColumns = db.prepare('PRAGMA table_info(time_entries)').all().map((column) => column.name);

    if (!timeEntryColumns.includes('start_time')) {
        db.exec('ALTER TABLE time_entries ADD COLUMN start_time TEXT;');
        db.exec('ALTER TABLE time_entries ADD COLUMN end_time TEXT;');
    }
}

// The ignore hints stop Turbopack tracing the whole project into the build output.
const DATABASE_FILE = path.resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH || path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'pegboards.db')
);

/**
 * Opens (creating if needed) the database file and sets connection options.
 *
 * @returns {DatabaseSync}
 */
function openDatabase() {
    fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });

    if (!fs.existsSync(DATABASE_FILE)) {
        // Leftover journal files from a deleted database would be replayed
        // into the new file and bring back fragments of the old data.
        for (const suffix of ['-wal', '-shm']) {
            fs.rmSync(`${DATABASE_FILE}${suffix}`, { force: true });
        }

        console.info(`Creating a new database at ${DATABASE_FILE}`);
    }

    const db = new DatabaseSync(DATABASE_FILE);

    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 5000;');

    return db;
}

// Module-level on purpose: a hot reload of this file resets it, so schema
// changes get applied to the connection cached on `globalThis`.
let schemaReady = false;

/**
 * Returns the shared database connection, with the schema up to date.
 * If the database file has been deleted since it was opened, a fresh one
 * is created in its place.
 *
 * The connection is cached on `globalThis` so dev-server hot reloads
 * don't open a new file handle on every edit.
 *
 * @returns {DatabaseSync}
 */
export function getDb() {
    const cached = globalThis.__pegboardsDb;

    // Never swap connections mid-transaction; the check runs again on the next call.
    if (cached && !cached.isTransaction && !fs.existsSync(DATABASE_FILE)) {
        console.warn(`Database file ${DATABASE_FILE} went missing; starting a new one.`);
        cached.close();
        globalThis.__pegboardsDb = null;
    }

    if (!globalThis.__pegboardsDb) {
        globalThis.__pegboardsDb = openDatabase();
        schemaReady = false;
    }

    const db = globalThis.__pegboardsDb;

    if (!schemaReady) {
        db.exec(SCHEMA);
        migrate(db);
        schemaReady = true;
    }

    return db;
}

/**
 * Runs `callback` inside a transaction, rolling back if it throws.
 * Nested calls join the outer transaction.
 *
 * @template T
 * @param {() => T} callback
 * @returns {T}
 */
export function transaction(callback) {
    const db = getDb();

    if (db.isTransaction) {
        return callback();
    }

    db.exec('BEGIN');

    try {
        const result = callback();
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

import { COLORS } from '@/lib/constants';

import { hashPassword } from './auth';
import { getDb } from './db';
import { HttpError } from './http';

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {'admin'|'member'} role
 * @property {string} color
 * @property {boolean} isActive
 */

/**
 * @param {Object} row
 * @returns {User}
 */
function toUser(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        color: row.color,
        isActive: row.is_active === 1,
    };
}

/**
 * Lists users, active ones first.
 *
 * @param {Object} [options]
 * @param {boolean} [options.includeInactive=false]
 * @returns {User[]}
 */
export function listUsers({ includeInactive = false } = {}) {
    const rows = getDb()
        .prepare(
            `SELECT id, name, email, role, color, is_active FROM users
             ${includeInactive ? '' : 'WHERE is_active = 1'}
             ORDER BY is_active DESC, name COLLATE NOCASE`
        )
        .all();

    return rows.map(toUser);
}

/**
 * @param {number} id
 * @returns {User|null}
 */
export function getUser(id) {
    const row = getDb()
        .prepare('SELECT id, name, email, role, color, is_active FROM users WHERE id = ?')
        .get(id);

    return row ? toUser(row) : null;
}

/**
 * Looks up a user with their password hash, for sign-in only.
 *
 * @param {string} email
 * @returns {{ id: number, passwordHash: string, isActive: boolean }|null}
 */
export function getCredentials(email) {
    const row = getDb()
        .prepare('SELECT id, password_hash, is_active FROM users WHERE email = ?')
        .get(email);

    return row ? { id: row.id, passwordHash: row.password_hash, isActive: row.is_active === 1 } : null;
}

/**
 * Creates a user account.
 *
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.email
 * @param {string} data.password
 * @param {'admin'|'member'} [data.role='member']
 * @param {string} [data.color]
 * @returns {number} The new user's id.
 */
export function createUser({ name, email, password, role = 'member', color }) {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (existing) {
        throw new HttpError(409, 'Someone already uses that email');
    }

    const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    const result = db
        .prepare('INSERT INTO users (name, email, password_hash, role, color) VALUES (?, ?, ?, ?, ?)')
        .run(name, email, hashPassword(password), role, color ?? COLORS[count % COLORS.length]);

    return Number(result.lastInsertRowid);
}

/**
 * Updates a user. Only provided fields change.
 *
 * @param {number} id
 * @param {Object} changes
 * @param {string} [changes.name]
 * @param {string} [changes.email]
 * @param {string} [changes.password]
 * @param {'admin'|'member'} [changes.role]
 * @param {string} [changes.color]
 * @param {boolean} [changes.isActive]
 * @returns {void}
 */
export function updateUser(id, changes) {
    const db = getDb();
    const columns = [];
    const values = [];

    if (changes.email !== undefined) {
        const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(changes.email, id);

        if (clash) {
            throw new HttpError(409, 'Someone already uses that email');
        }
    }

    const wouldLoseAdmin = changes.role === 'member' || changes.isActive === false;

    if (wouldLoseAdmin) {
        const otherAdmins = db
            .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?")
            .get(id).count;
        const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id);

        if (target?.role === 'admin' && otherAdmins === 0) {
            throw new HttpError(400, 'The workspace needs at least one active admin');
        }
    }

    const mapping = {
        name: 'name',
        email: 'email',
        role: 'role',
        color: 'color',
    };

    for (const [key, column] of Object.entries(mapping)) {
        if (changes[key] !== undefined) {
            columns.push(`${column} = ?`);
            values.push(changes[key]);
        }
    }

    if (changes.password !== undefined) {
        columns.push('password_hash = ?');
        values.push(hashPassword(changes.password));
    }

    if (changes.isActive !== undefined) {
        columns.push('is_active = ?');
        values.push(changes.isActive ? 1 : 0);
    }

    if (columns.length === 0) {
        return;
    }

    db.prepare(`UPDATE users SET ${columns.join(', ')} WHERE id = ?`).run(...values, id);

    if (changes.isActive === false || changes.password !== undefined) {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
}

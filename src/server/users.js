import { COLORS } from '@/lib/constants';

import { hashPassword } from './auth';
import { collection, insertWithId } from './db';
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

const PUBLIC_FIELDS = { name: 1, email: 1, role: 1, color: 1, isActive: 1 };

/**
 * @param {Object} doc
 * @returns {User}
 */
function toUser(doc) {
    return {
        id: doc._id,
        name: doc.name,
        email: doc.email,
        role: doc.role,
        color: doc.color,
        isActive: doc.isActive,
    };
}

/**
 * Lists users, active ones first.
 *
 * @param {Object} [options]
 * @param {boolean} [options.includeInactive=false]
 * @returns {Promise<User[]>}
 */
export async function listUsers({ includeInactive = false } = {}) {
    const docs = await (await collection('users'))
        .find(includeInactive ? {} : { isActive: true }, { projection: PUBLIC_FIELDS })
        .collation({ locale: 'en', strength: 2 })
        .sort({ isActive: -1, name: 1 })
        .toArray();

    return docs.map(toUser);
}

/**
 * @param {number} id
 * @returns {Promise<User|null>}
 */
export async function getUser(id) {
    const doc = await (await collection('users')).findOne({ _id: id }, { projection: PUBLIC_FIELDS });

    return doc ? toUser(doc) : null;
}

/**
 * Looks up a user with their password hash, for sign-in only.
 *
 * @param {string} email
 * @returns {Promise<{ id: number, passwordHash: string, isActive: boolean }|null>}
 */
export async function getCredentials(email) {
    const doc = await (await collection('users')).findOne({ email });

    return doc ? { id: doc._id, passwordHash: doc.passwordHash, isActive: doc.isActive } : null;
}

/**
 * Creates a user account.
 *
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.email - Already lowercased by validation.
 * @param {string} data.password
 * @param {'admin'|'member'} [data.role='member']
 * @param {string} [data.color]
 * @returns {Promise<number>} The new user's id.
 */
export async function createUser({ name, email, password, role = 'member', color }) {
    const users = await collection('users');

    if (await users.findOne({ email })) {
        throw new HttpError(409, 'Someone already uses that email');
    }

    const count = await users.countDocuments();

    try {
        return await insertWithId('users', {
            name,
            email,
            passwordHash: hashPassword(password),
            role,
            color: color ?? COLORS[count % COLORS.length],
            isActive: true,
            createdAt: new Date(),
        });
    } catch (error) {
        // Two sign-ups racing past the check above hit the unique index instead.
        if (error.code === 11000) {
            throw new HttpError(409, 'Someone already uses that email');
        }

        throw error;
    }
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
 * @returns {Promise<void>}
 */
export async function updateUser(id, changes) {
    const users = await collection('users');
    const update = {};

    if (changes.email !== undefined && (await users.findOne({ email: changes.email, _id: { $ne: id } }))) {
        throw new HttpError(409, 'Someone already uses that email');
    }

    if (changes.role === 'member' || changes.isActive === false) {
        const target = await users.findOne({ _id: id }, { projection: { role: 1 } });
        const otherAdmins = await users.countDocuments({ role: 'admin', isActive: true, _id: { $ne: id } });

        if (target?.role === 'admin' && otherAdmins === 0) {
            throw new HttpError(400, 'The workspace needs at least one active admin');
        }
    }

    for (const key of ['name', 'email', 'role', 'color', 'isActive']) {
        if (changes[key] !== undefined) {
            update[key] = changes[key];
        }
    }

    if (changes.password !== undefined) {
        update.passwordHash = hashPassword(changes.password);
    }

    if (Object.keys(update).length === 0) {
        return;
    }

    await users.updateOne({ _id: id }, { $set: update });

    if (changes.isActive === false || changes.password !== undefined) {
        await (await collection('sessions')).deleteMany({ userId: id });
    }
}

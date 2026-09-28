import crypto from 'node:crypto';

import { collection } from './db';
import { HttpError } from './http';

const SESSION_COOKIE = 'pegboards_session';
const SESSION_DAYS = 30;
const SCRYPT_KEY_LENGTH = 64;

/**
 * @typedef {Object} SessionUser
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {'admin'|'member'} role
 * @property {string} color
 */

/**
 * Hashes a password with a random salt using scrypt.
 *
 * @param {string} password
 * @returns {string} `salt:hash`, both hex-encoded.
 */
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');

    return `${salt}:${hash}`;
}

/**
 * Checks a password against a stored `salt:hash`.
 *
 * @param {string} password
 * @param {string} stored
 * @returns {boolean}
 */
export function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');

    if (!salt || !hash) {
        return false;
    }

    const expected = Buffer.from(hash, 'hex');
    const actual = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);

    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * Only a hash of the token is stored, so a leaked database can't be
 * used to hijack live sessions.
 *
 * @param {string} token
 * @returns {string}
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * @param {string} name
 * @param {string} value
 * @param {number} maxAgeSeconds
 * @returns {string}
 */
function serializeCookie(name, value, maxAgeSeconds) {
    const parts = [
        `${name}=${value}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${maxAgeSeconds}`,
    ];

    if (process.env.NODE_ENV === 'production') {
        parts.push('Secure');
    }

    return parts.join('; ');
}

/**
 * Creates a session for the user and sets the session cookie.
 *
 * @param {import('http').ServerResponse} res
 * @param {number} userId
 * @returns {Promise<void>}
 */
export async function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await (await collection('sessions')).insertOne({ _id: hashToken(token), userId, expiresAt });

    res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, token, SESSION_DAYS * 24 * 60 * 60));
}

/**
 * Deletes the current session and clears the cookie.
 *
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {Promise<void>}
 */
export async function endSession(req, res) {
    const token = req.cookies?.[SESSION_COOKIE];

    if (token) {
        await (await collection('sessions')).deleteOne({ _id: hashToken(token) });
    }

    res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', 0));
}

/**
 * Resolves the signed-in user from the request's session cookie.
 *
 * @param {{ cookies?: Partial<Record<string, string>> }} req
 * @returns {Promise<SessionUser|null>}
 */
export async function getSessionUser(req) {
    const token = req.cookies?.[SESSION_COOKIE];

    if (!token || !/^[0-9a-f]{64}$/.test(token)) {
        return null;
    }

    // Checked here too: the TTL cleanup runs only about once a minute.
    const session = await (await collection('sessions')).findOne({
        _id: hashToken(token),
        expiresAt: { $gt: new Date() },
    });

    if (!session) {
        return null;
    }

    const user = await (await collection('users')).findOne(
        { _id: session.userId, isActive: true },
        { projection: { name: 1, email: 1, role: 1, color: 1 } }
    );

    return user ? { id: user._id, name: user.name, email: user.email, role: user.role, color: user.color } : null;
}

/**
 * Returns the signed-in user or throws a 401.
 *
 * @param {import('next').NextApiRequest} req
 * @param {Object} [options]
 * @param {boolean} [options.admin=false] - Also require the admin role.
 * @returns {Promise<SessionUser>}
 */
export async function requireUser(req, { admin = false } = {}) {
    const user = await getSessionUser(req);

    if (!user) {
        throw new HttpError(401, 'Please sign in');
    }

    if (admin && user.role !== 'admin') {
        throw new HttpError(403, 'Only admins can do that');
    }

    return user;
}

/**
 * True when no accounts exist yet, so the first visitor can create the admin.
 *
 * @returns {Promise<boolean>}
 */
export async function needsSetup() {
    return (await (await collection('users')).countDocuments({}, { limit: 1 })) === 0;
}

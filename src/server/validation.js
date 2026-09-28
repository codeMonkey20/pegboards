import { HttpError } from './http';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * @param {string} field
 * @param {string} problem
 * @returns {never}
 */
function fail(field, problem) {
    throw new HttpError(400, `${field} ${problem}`);
}

/**
 * Validates a string.
 *
 * @param {unknown} value
 * @param {string} field - Human-readable field name used in error messages.
 * @param {Object} [options]
 * @param {number} [options.min=0]
 * @param {number} [options.max=500]
 * @returns {string}
 */
export function string(value, field, { min = 0, max = 500 } = {}) {
    if (typeof value !== 'string') {
        fail(field, 'must be text');
    }

    const trimmed = value.trim();

    if (trimmed.length < min) {
        fail(field, min === 1 ? 'is required' : `must be at least ${min} characters`);
    }

    if (trimmed.length > max) {
        fail(field, `must be at most ${max} characters`);
    }

    return trimmed;
}

/**
 * Validates one of a fixed set of values.
 *
 * @template T
 * @param {unknown} value
 * @param {string} field
 * @param {readonly T[]} allowed
 * @returns {T}
 */
export function oneOf(value, field, allowed) {
    if (!allowed.includes(/** @type {T} */ (value))) {
        fail(field, 'is not a valid option');
    }

    return /** @type {T} */ (value);
}

/**
 * Validates a number, optionally allowing null/empty.
 *
 * @param {unknown} value
 * @param {string} field
 * @param {Object} [options]
 * @param {number} [options.min]
 * @param {number} [options.max]
 * @param {boolean} [options.nullable=false]
 * @param {boolean} [options.integer=false]
 * @returns {number|null}
 */
export function number(value, field, { min, max, nullable = false, integer = false } = {}) {
    if (nullable && (value === null || value === '' || value === undefined)) {
        return null;
    }

    const parsed = typeof value === 'string' ? Number(value) : value;

    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
        fail(field, 'must be a number');
    }

    if (integer && !Number.isInteger(parsed)) {
        fail(field, 'must be a whole number');
    }

    if (min !== undefined && parsed < min) {
        fail(field, `must be at least ${min}`);
    }

    if (max !== undefined && parsed > max) {
        fail(field, `must be at most ${max}`);
    }

    return parsed;
}

/**
 * Validates a positive integer id, optionally allowing null.
 *
 * @param {unknown} value
 * @param {string} field
 * @param {Object} [options]
 * @param {boolean} [options.nullable=false]
 * @returns {number|null}
 */
export function id(value, field, { nullable = false } = {}) {
    return number(value, field, { min: 1, integer: true, nullable });
}

/**
 * Validates a `YYYY-MM-DD` date string, optionally allowing null.
 *
 * @param {unknown} value
 * @param {string} field
 * @param {Object} [options]
 * @param {boolean} [options.nullable=false]
 * @returns {string|null}
 */
export function date(value, field, { nullable = false } = {}) {
    if (nullable && (value === null || value === '' || value === undefined)) {
        return null;
    }

    if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
        fail(field, 'must be a valid date');
    }

    return value;
}

/**
 * Validates a 24-hour `HH:MM` time.
 *
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function time(value, field) {
    if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
        fail(field, 'must be a time like 09:30');
    }

    return value;
}

/**
 * Validates a `#rrggbb` hex color.
 *
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function color(value, field) {
    if (typeof value !== 'string' || !COLOR_PATTERN.test(value)) {
        fail(field, 'must be a hex color');
    }

    return value.toLowerCase();
}

/**
 * Validates a boolean.
 *
 * @param {unknown} value
 * @param {string} field
 * @returns {boolean}
 */
export function boolean(value, field) {
    if (typeof value !== 'boolean') {
        fail(field, 'must be true or false');
    }

    return value;
}

/**
 * Validates an email address (shape only).
 *
 * @param {unknown} value
 * @returns {string}
 */
export function email(value) {
    const trimmed = string(value, 'Email', { min: 3, max: 254 }).toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        fail('Email', 'is not valid');
    }

    return trimmed;
}

/**
 * Validates a new password.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function password(value) {
    if (typeof value !== 'string' || value.length < 8 || value.length > 200) {
        fail('Password', 'must be 8–200 characters');
    }

    return value;
}

/**
 * Returns the request body as an object, rejecting anything else.
 *
 * @param {import('next').NextApiRequest} req
 * @returns {Record<string, unknown>}
 */
export function body(req) {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        throw new HttpError(400, 'Expected a JSON object');
    }

    return req.body;
}

/**
 * Returns true when `key` was sent in the body, so PATCH handlers only
 * touch the fields the client actually provided.
 *
 * @param {Record<string, unknown>} data
 * @param {string} key
 * @returns {boolean}
 */
export function has(data, key) {
    return Object.prototype.hasOwnProperty.call(data, key);
}

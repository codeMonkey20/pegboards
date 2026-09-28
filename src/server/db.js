import { MongoClient } from 'mongodb';

/**
 * Collections and the indexes they need. Documents use integer `_id`s
 * (from the `counters` collection) so URLs and ids stay short and numeric.
 */
const INDEXES = {
    users: [{ key: { email: 1 }, unique: true }],
    sessions: [
        { key: { userId: 1 } },
        // MongoDB deletes expired sessions automatically.
        { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ],
    statuses: [{ key: { projectId: 1, position: 1 } }],
    tasks: [{ key: { projectId: 1, statusId: 1, position: 1 } }, { key: { assigneeId: 1 } }],
    timeEntries: [{ key: { taskId: 1 } }, { key: { userId: 1, date: 1 } }],
    comments: [{ key: { taskId: 1 } }],
    dashboards: [{ key: { ownerId: 1 } }],
    widgets: [{ key: { dashboardId: 1, position: 1 } }],
};

/**
 * @returns {Promise<import('mongodb').Db>}
 */
async function connect() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error('MONGODB_URI is not set. Add it to .env.local (see .env.example).');
    }

    const client = new MongoClient(uri);

    await client.connect();

    const db = client.db(process.env.MONGODB_DB || 'pegboards');

    await Promise.all(
        Object.entries(INDEXES).map(([name, indexes]) =>
            db.collection(name).createIndexes(indexes.map((index) => ({ ...index })))
        )
    );

    return db;
}

/**
 * Returns the shared database handle.
 *
 * The connection promise is cached on `globalThis` so serverless
 * invocations and dev-server hot reloads reuse one connection pool. A
 * failed connection isn't cached, so the next request retries.
 *
 * @returns {Promise<import('mongodb').Db>}
 */
export function getDb() {
    if (!globalThis.__pegboardsDb) {
        globalThis.__pegboardsDb = connect().catch((error) => {
            globalThis.__pegboardsDb = null;
            throw error;
        });
    }

    return globalThis.__pegboardsDb;
}

/**
 * Shortcut for `(await getDb()).collection(name)`.
 *
 * @param {string} name
 * @returns {Promise<import('mongodb').Collection>}
 */
export async function collection(name) {
    return (await getDb()).collection(name);
}

/**
 * Reserves the next integer id for a collection.
 *
 * @param {string} name - Collection name.
 * @returns {Promise<number>}
 */
export async function nextId(name) {
    const [id] = await reserveIds(name, 1);

    return id;
}

/**
 * Reserves `count` consecutive integer ids in one round trip, for bulk inserts.
 *
 * @param {string} name - Collection name.
 * @param {number} count
 * @returns {Promise<number[]>}
 */
export async function reserveIds(name, count) {
    const counters = await collection('counters');
    const counter = await counters.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: count } },
        { upsert: true, returnDocument: 'after' }
    );
    const first = counter.seq - count + 1;

    return Array.from({ length: count }, (_, index) => first + index);
}

/**
 * Inserts a document with a fresh integer id.
 *
 * @param {string} name - Collection name.
 * @param {Object} document - Without `_id`.
 * @returns {Promise<number>} The new id.
 */
export async function insertWithId(name, document) {
    const id = await nextId(name);

    await (await collection(name)).insertOne({ _id: id, ...document });

    return id;
}

/**
 * Rewrites `position` so documents are numbered 0..n in the given order.
 *
 * @param {string} name - Collection name.
 * @param {number[]} ids - Document ids in their new order.
 * @param {Object} [extra] - Extra fields to set on every document.
 * @returns {Promise<void>}
 */
export async function setPositions(name, ids, extra = {}) {
    if (ids.length === 0) {
        return;
    }

    await (await collection(name)).bulkWrite(
        ids.map((id, position) => ({
            updateOne: { filter: { _id: id }, update: { $set: { ...extra, position } } },
        }))
    );
}

/**
 * Next.js page props must be plain JSON, so Dates become ISO strings.
 *
 * @param {Date|null|undefined} value
 * @returns {string|null}
 */
export function toISO(value) {
    return value ? value.toISOString() : null;
}

import { collection, insertWithId, setPositions } from './db';
import { HttpError } from './http';
import { computeMetric, sanitizeWidgetConfig } from './metrics';

/**
 * @typedef {Object} Dashboard
 * @property {number} id
 * @property {string} name
 * @property {number} ownerId
 * @property {string} ownerName
 * @property {boolean} isShared
 * @property {number} widgetCount
 */

/**
 * @typedef {Object} Widget
 * @property {number} id
 * @property {string} title
 * @property {import('@/lib/constants').WidgetConfig} config
 * @property {string} width
 * @property {number} position
 * @property {import('./metrics').MetricResult} data
 */

/**
 * Adds owner names and widget counts to dashboard documents.
 *
 * @param {Object[]} docs
 * @returns {Promise<Dashboard[]>}
 */
async function toDashboards(docs) {
    const ids = docs.map((doc) => doc._id);
    const [owners, counts] = await Promise.all([
        (await collection('users'))
            .find({ _id: { $in: docs.map((doc) => doc.ownerId) } }, { projection: { name: 1 } })
            .toArray(),
        (await collection('widgets'))
            .aggregate([{ $match: { dashboardId: { $in: ids } } }, { $group: { _id: '$dashboardId', total: { $sum: 1 } } }])
            .toArray(),
    ]);
    const ownerNames = new Map(owners.map((owner) => [owner._id, owner.name]));
    const widgetCounts = new Map(counts.map((count) => [count._id, count.total]));

    return docs.map((doc) => ({
        id: doc._id,
        name: doc.name,
        ownerId: doc.ownerId,
        ownerName: ownerNames.get(doc.ownerId) ?? 'Deleted user',
        isShared: doc.isShared,
        widgetCount: widgetCounts.get(doc._id) ?? 0,
    }));
}

/**
 * Dashboards the user owns, plus ones teammates have shared.
 *
 * @param {number} userId
 * @returns {Promise<Dashboard[]>}
 */
export async function listDashboards(userId) {
    const docs = await (await collection('dashboards'))
        .find({ $or: [{ ownerId: userId }, { isShared: true }] })
        .collation({ locale: 'en', strength: 2 })
        .sort({ name: 1 })
        .toArray();

    return toDashboards(docs);
}

/**
 * Loads a dashboard the user may see, and whether they may edit it.
 *
 * @param {number} id
 * @param {import('./auth').SessionUser} user
 * @returns {Promise<Dashboard & { canEdit: boolean }>}
 */
export async function requireDashboard(id, user) {
    const doc = await (await collection('dashboards')).findOne({ _id: id });

    if (!doc || (doc.ownerId !== user.id && !doc.isShared)) {
        throw new HttpError(404, 'Dashboard not found');
    }

    const [dashboard] = await toDashboards([doc]);

    return { ...dashboard, canEdit: doc.ownerId === user.id || user.role === 'admin' };
}

/**
 * Same as `requireDashboard`, but also requires edit rights.
 *
 * @param {number} id
 * @param {import('./auth').SessionUser} user
 * @returns {Promise<Dashboard>}
 */
export async function requireEditableDashboard(id, user) {
    const dashboard = await requireDashboard(id, user);

    if (!dashboard.canEdit) {
        throw new HttpError(403, 'Only the owner can change this dashboard');
    }

    return dashboard;
}

/**
 * @param {number} ownerId
 * @param {string} name
 * @param {Object} [options]
 * @param {boolean} [options.isShared=false]
 * @returns {Promise<number>}
 */
export async function createDashboard(ownerId, name, { isShared = false } = {}) {
    return insertWithId('dashboards', { name, ownerId, isShared, createdAt: new Date() });
}

/**
 * @param {number} id
 * @param {{ name?: string, isShared?: boolean }} changes
 * @returns {Promise<void>}
 */
export async function updateDashboard(id, changes) {
    const update = {};

    for (const key of ['name', 'isShared']) {
        if (changes[key] !== undefined) {
            update[key] = changes[key];
        }
    }

    if (Object.keys(update).length > 0) {
        await (await collection('dashboards')).updateOne({ _id: id }, { $set: update });
    }
}

/**
 * Deletes a dashboard and its widgets.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteDashboard(id) {
    await (await collection('widgets')).deleteMany({ dashboardId: id });
    await (await collection('dashboards')).deleteOne({ _id: id });
}

/**
 * @param {Object} doc
 * @param {number} viewerId
 * @returns {Promise<Widget>}
 */
async function toWidget(doc, viewerId) {
    // Sanitised on read so one bad document can't break a dashboard.
    const config = sanitizeWidgetConfig(doc.config);

    return {
        id: doc._id,
        title: doc.title,
        config,
        width: doc.width,
        position: doc.position,
        data: await computeMetric(config, viewerId),
    };
}

/**
 * Lists a dashboard's widgets with their computed data.
 *
 * @param {number} dashboardId
 * @param {number} viewerId
 * @returns {Promise<Widget[]>}
 */
export async function listWidgets(dashboardId, viewerId) {
    const docs = await (await collection('widgets')).find({ dashboardId }).sort({ position: 1, _id: 1 }).toArray();

    return Promise.all(docs.map((doc) => toWidget(doc, viewerId)));
}

/**
 * Loads a widget's id and the dashboard it sits on.
 *
 * @param {number} id
 * @returns {Promise<{ id: number, dashboardId: number }>}
 */
export async function requireWidget(id) {
    const doc = await (await collection('widgets')).findOne({ _id: id }, { projection: { dashboardId: 1 } });

    if (!doc) {
        throw new HttpError(404, 'Widget not found');
    }

    return { id: doc._id, dashboardId: doc.dashboardId };
}

/**
 * @param {number} id
 * @param {number} viewerId
 * @returns {Promise<Widget>}
 */
export async function getWidget(id, viewerId) {
    return toWidget(await (await collection('widgets')).findOne({ _id: id }), viewerId);
}

/**
 * Adds a widget to the end of a dashboard.
 *
 * @param {number} dashboardId
 * @param {{ title: string, config: import('@/lib/constants').WidgetConfig, width: string }} data
 * @returns {Promise<number>}
 */
export async function createWidget(dashboardId, { title, config, width }) {
    const last = await (await collection('widgets')).findOne({ dashboardId }, { sort: { position: -1 } });

    return insertWithId('widgets', {
        dashboardId,
        title,
        config,
        width,
        position: last ? last.position + 1 : 0,
    });
}

/**
 * @param {number} id
 * @param {{ title?: string, config?: import('@/lib/constants').WidgetConfig, width?: string }} changes
 * @returns {Promise<void>}
 */
export async function updateWidget(id, changes) {
    const update = {};

    for (const key of ['title', 'config', 'width']) {
        if (changes[key] !== undefined) {
            update[key] = changes[key];
        }
    }

    if (Object.keys(update).length > 0) {
        await (await collection('widgets')).updateOne({ _id: id }, { $set: update });
    }
}

/**
 * Swaps a widget with its neighbour.
 *
 * @param {number} id
 * @param {-1|1} direction
 * @returns {Promise<void>}
 */
export async function moveWidget(id, direction) {
    const { dashboardId } = await requireWidget(id);
    const ids = (await (await collection('widgets')).find({ dashboardId }).sort({ position: 1, _id: 1 }).toArray()).map(
        (doc) => doc._id
    );
    const index = ids.indexOf(id);
    const target = index + direction;

    if (target < 0 || target >= ids.length) {
        return;
    }

    [ids[index], ids[target]] = [ids[target], ids[index]];
    await setPositions('widgets', ids);
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteWidget(id) {
    await (await collection('widgets')).deleteOne({ _id: id });
}

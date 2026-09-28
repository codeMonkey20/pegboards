import { getDb, transaction } from './db';
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

const DASHBOARD_SELECT = `
    SELECT d.id, d.name, d.owner_id, d.is_shared, u.name AS owner_name,
           (SELECT COUNT(*) FROM widgets WHERE dashboard_id = d.id) AS widget_count
    FROM dashboards d
    JOIN users u ON u.id = d.owner_id
`;

/**
 * @param {Object} row
 * @returns {Dashboard}
 */
function toDashboard(row) {
    return {
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        ownerName: row.owner_name,
        isShared: row.is_shared === 1,
        widgetCount: row.widget_count,
    };
}

/**
 * Dashboards the user owns, plus ones teammates have shared.
 *
 * @param {number} userId
 * @returns {Dashboard[]}
 */
export function listDashboards(userId) {
    return getDb()
        .prepare(`${DASHBOARD_SELECT} WHERE d.owner_id = ? OR d.is_shared = 1 ORDER BY d.name COLLATE NOCASE`)
        .all(userId)
        .map(toDashboard);
}

/**
 * Loads a dashboard the user may see, and whether they may edit it.
 *
 * @param {number} id
 * @param {import('./auth').SessionUser} user
 * @returns {Dashboard & { canEdit: boolean }}
 */
export function requireDashboard(id, user) {
    const row = getDb().prepare(`${DASHBOARD_SELECT} WHERE d.id = ?`).get(id);

    if (!row || (row.owner_id !== user.id && row.is_shared !== 1)) {
        throw new HttpError(404, 'Dashboard not found');
    }

    return { ...toDashboard(row), canEdit: row.owner_id === user.id || user.role === 'admin' };
}

/**
 * Same as `requireDashboard`, but also requires edit rights.
 *
 * @param {number} id
 * @param {import('./auth').SessionUser} user
 * @returns {Dashboard}
 */
export function requireEditableDashboard(id, user) {
    const dashboard = requireDashboard(id, user);

    if (!dashboard.canEdit) {
        throw new HttpError(403, 'Only the owner can change this dashboard');
    }

    return dashboard;
}

/**
 * @param {number} ownerId
 * @param {string} name
 * @returns {number}
 */
export function createDashboard(ownerId, name) {
    const result = getDb().prepare('INSERT INTO dashboards (owner_id, name) VALUES (?, ?)').run(ownerId, name);

    return Number(result.lastInsertRowid);
}

/**
 * @param {number} id
 * @param {{ name?: string, isShared?: boolean }} changes
 * @returns {void}
 */
export function updateDashboard(id, changes) {
    const db = getDb();

    if (changes.name !== undefined) {
        db.prepare('UPDATE dashboards SET name = ? WHERE id = ?').run(changes.name, id);
    }

    if (changes.isShared !== undefined) {
        db.prepare('UPDATE dashboards SET is_shared = ? WHERE id = ?').run(changes.isShared ? 1 : 0, id);
    }
}

/**
 * @param {number} id
 * @returns {void}
 */
export function deleteDashboard(id) {
    getDb().prepare('DELETE FROM dashboards WHERE id = ?').run(id);
}

/**
 * @param {Object} row
 * @param {number} viewerId
 * @returns {Widget}
 */
function toWidget(row, viewerId) {
    let parsed = null;

    try {
        parsed = JSON.parse(row.config);
    } catch (error) {
        console.error(`Widget ${row.id} has an unreadable config; using defaults.`, error);
    }

    const config = sanitizeWidgetConfig(parsed);

    return {
        id: row.id,
        title: row.title,
        config,
        width: row.width,
        position: row.position,
        data: computeMetric(config, viewerId),
    };
}

/**
 * Lists a dashboard's widgets with their computed data.
 *
 * @param {number} dashboardId
 * @param {number} viewerId
 * @returns {Widget[]}
 */
export function listWidgets(dashboardId, viewerId) {
    return getDb()
        .prepare('SELECT * FROM widgets WHERE dashboard_id = ? ORDER BY position, id')
        .all(dashboardId)
        .map((row) => toWidget(row, viewerId));
}

/**
 * Loads a widget and the dashboard it sits on.
 *
 * @param {number} id
 * @returns {{ id: number, dashboardId: number }}
 */
export function requireWidget(id) {
    const row = getDb().prepare('SELECT id, dashboard_id FROM widgets WHERE id = ?').get(id);

    if (!row) {
        throw new HttpError(404, 'Widget not found');
    }

    return { id: row.id, dashboardId: row.dashboard_id };
}

/**
 * @param {number} id
 * @param {number} viewerId
 * @returns {Widget}
 */
export function getWidget(id, viewerId) {
    return toWidget(getDb().prepare('SELECT * FROM widgets WHERE id = ?').get(id), viewerId);
}

/**
 * Adds a widget to the end of a dashboard.
 *
 * @param {number} dashboardId
 * @param {{ title: string, config: import('@/lib/constants').WidgetConfig, width: string }} data
 * @returns {number}
 */
export function createWidget(dashboardId, { title, config, width }) {
    const db = getDb();
    const { next } = db
        .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM widgets WHERE dashboard_id = ?')
        .get(dashboardId);
    const result = db
        .prepare('INSERT INTO widgets (dashboard_id, title, config, width, position) VALUES (?, ?, ?, ?, ?)')
        .run(dashboardId, title, JSON.stringify(config), width, next);

    return Number(result.lastInsertRowid);
}

/**
 * @param {number} id
 * @param {{ title?: string, config?: import('@/lib/constants').WidgetConfig, width?: string }} changes
 * @returns {void}
 */
export function updateWidget(id, changes) {
    const db = getDb();

    if (changes.title !== undefined) {
        db.prepare('UPDATE widgets SET title = ? WHERE id = ?').run(changes.title, id);
    }

    if (changes.config !== undefined) {
        db.prepare('UPDATE widgets SET config = ? WHERE id = ?').run(JSON.stringify(changes.config), id);
    }

    if (changes.width !== undefined) {
        db.prepare('UPDATE widgets SET width = ? WHERE id = ?').run(changes.width, id);
    }
}

/**
 * Swaps a widget with its neighbour.
 *
 * @param {number} id
 * @param {-1|1} direction
 * @returns {void}
 */
export function moveWidget(id, direction) {
    transaction(() => {
        const db = getDb();
        const { dashboardId } = requireWidget(id);
        const ids = db
            .prepare('SELECT id FROM widgets WHERE dashboard_id = ? ORDER BY position, id')
            .all(dashboardId)
            .map((row) => row.id);
        const index = ids.indexOf(id);
        const target = index + direction;

        if (target < 0 || target >= ids.length) {
            return;
        }

        [ids[index], ids[target]] = [ids[target], ids[index]];

        const update = db.prepare('UPDATE widgets SET position = ? WHERE id = ?');
        ids.forEach((widgetId, position) => update.run(position, widgetId));
    });
}

/**
 * @param {number} id
 * @returns {void}
 */
export function deleteWidget(id) {
    getDb().prepare('DELETE FROM widgets WHERE id = ?').run(id);
}

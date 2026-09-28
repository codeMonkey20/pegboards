import { DEFAULT_STATUSES } from '@/lib/constants';

import { getDb, transaction } from './db';
import { HttpError } from './http';

/**
 * @typedef {Object} Project
 * @property {number} id
 * @property {string} name
 * @property {string} description
 * @property {string} color
 */

/**
 * @typedef {Object} Status
 * @property {number} id
 * @property {number} projectId
 * @property {string} name
 * @property {string} color
 * @property {number} position
 * @property {boolean} isDone
 */

/**
 * @param {Object} row
 * @returns {Status}
 */
function toStatus(row) {
    return {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        color: row.color,
        position: row.position,
        isDone: row.is_done === 1,
    };
}

/**
 * Lists boards with task counts for the boards overview.
 *
 * @returns {(Project & { taskCount: number, openCount: number })[]}
 */
export function listProjects() {
    const rows = getDb()
        .prepare(
            `SELECT p.id, p.name, p.description, p.color,
                    COUNT(t.id) AS task_count,
                    COALESCE(SUM(CASE WHEN t.completed_at IS NULL THEN 1 ELSE 0 END), 0) AS open_count
             FROM projects p
             LEFT JOIN tasks t ON t.project_id = p.id
             GROUP BY p.id
             ORDER BY p.name COLLATE NOCASE`
        )
        .all();

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        taskCount: row.task_count,
        openCount: row.open_count,
    }));
}

/**
 * @param {number} id
 * @returns {Project|null}
 */
export function getProject(id) {
    const row = getDb().prepare('SELECT id, name, description, color FROM projects WHERE id = ?').get(id);

    return row ? { ...row } : null;
}

/**
 * @param {number} id
 * @returns {Project}
 */
export function requireProject(id) {
    const project = getProject(id);

    if (!project) {
        throw new HttpError(404, 'Board not found');
    }

    return project;
}

/**
 * Creates a board with the default columns.
 *
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.description
 * @param {string} data.color
 * @param {number} data.createdBy
 * @returns {number} The new board's id.
 */
export function createProject({ name, description, color, createdBy }) {
    return transaction(() => {
        const db = getDb();
        const result = db
            .prepare('INSERT INTO projects (name, description, color, created_by) VALUES (?, ?, ?, ?)')
            .run(name, description, color, createdBy);
        const projectId = Number(result.lastInsertRowid);
        const insertStatus = db.prepare(
            'INSERT INTO statuses (project_id, name, color, position, is_done) VALUES (?, ?, ?, ?, ?)'
        );

        DEFAULT_STATUSES.forEach((status, index) => {
            insertStatus.run(projectId, status.name, status.color, index, status.isDone ? 1 : 0);
        });

        return projectId;
    });
}

/**
 * @param {number} id
 * @param {{ name?: string, description?: string, color?: string }} changes
 * @returns {void}
 */
export function updateProject(id, changes) {
    const columns = [];
    const values = [];

    for (const key of ['name', 'description', 'color']) {
        if (changes[key] !== undefined) {
            columns.push(`${key} = ?`);
            values.push(changes[key]);
        }
    }

    if (columns.length > 0) {
        getDb().prepare(`UPDATE projects SET ${columns.join(', ')} WHERE id = ?`).run(...values, id);
    }
}

/**
 * Deletes a board and everything on it.
 *
 * @param {number} id
 * @returns {void}
 */
export function deleteProject(id) {
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
}

/**
 * @param {number} projectId
 * @returns {Status[]}
 */
export function listStatuses(projectId) {
    return getDb()
        .prepare('SELECT * FROM statuses WHERE project_id = ? ORDER BY position, id')
        .all(projectId)
        .map(toStatus);
}

/**
 * @param {number} id
 * @returns {Status}
 */
export function requireStatus(id) {
    const row = getDb().prepare('SELECT * FROM statuses WHERE id = ?').get(id);

    if (!row) {
        throw new HttpError(404, 'Column not found');
    }

    return toStatus(row);
}

/**
 * Adds a column to the end of a board.
 *
 * @param {number} projectId
 * @param {{ name: string, color: string, isDone: boolean }} data
 * @returns {Status}
 */
export function createStatus(projectId, { name, color, isDone }) {
    const db = getDb();
    const { next } = db
        .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM statuses WHERE project_id = ?')
        .get(projectId);
    const result = db
        .prepare('INSERT INTO statuses (project_id, name, color, position, is_done) VALUES (?, ?, ?, ?, ?)')
        .run(projectId, name, color, next, isDone ? 1 : 0);

    return requireStatus(Number(result.lastInsertRowid));
}

/**
 * Updates a column. Toggling "done" also stamps or clears completion
 * dates on its tasks so completion metrics stay accurate.
 *
 * @param {number} id
 * @param {{ name?: string, color?: string, isDone?: boolean }} changes
 * @returns {Status}
 */
export function updateStatus(id, changes) {
    return transaction(() => {
        const db = getDb();
        const current = requireStatus(id);

        if (changes.name !== undefined || changes.color !== undefined) {
            db.prepare('UPDATE statuses SET name = ?, color = ? WHERE id = ?').run(
                changes.name ?? current.name,
                changes.color ?? current.color,
                id
            );
        }

        if (changes.isDone !== undefined && changes.isDone !== current.isDone) {
            db.prepare('UPDATE statuses SET is_done = ? WHERE id = ?').run(changes.isDone ? 1 : 0, id);

            if (changes.isDone) {
                db.prepare(
                    "UPDATE tasks SET completed_at = datetime('now') WHERE status_id = ? AND completed_at IS NULL"
                ).run(id);
            } else {
                db.prepare('UPDATE tasks SET completed_at = NULL WHERE status_id = ?').run(id);
            }
        }

        return requireStatus(id);
    });
}

/**
 * Moves a column one place left or right.
 *
 * @param {number} id
 * @param {-1|1} direction
 * @returns {Status[]} The board's columns in their new order.
 */
export function moveStatus(id, direction) {
    return transaction(() => {
        const status = requireStatus(id);
        const statuses = listStatuses(status.projectId);
        const index = statuses.findIndex((item) => item.id === id);
        const target = index + direction;

        if (target >= 0 && target < statuses.length) {
            [statuses[index], statuses[target]] = [statuses[target], statuses[index]];

            const update = getDb().prepare('UPDATE statuses SET position = ? WHERE id = ?');
            statuses.forEach((item, position) => update.run(position, item.id));
        }

        return listStatuses(status.projectId);
    });
}

/**
 * Deletes an empty column.
 *
 * @param {number} id
 * @returns {void}
 */
export function deleteStatus(id) {
    const db = getDb();
    const status = requireStatus(id);
    const { taskCount } = db.prepare('SELECT COUNT(*) AS taskCount FROM tasks WHERE status_id = ?').get(id);
    const { statusCount } = db
        .prepare('SELECT COUNT(*) AS statusCount FROM statuses WHERE project_id = ?')
        .get(status.projectId);

    if (taskCount > 0) {
        throw new HttpError(400, 'Move or delete the tasks in this column first');
    }

    if (statusCount <= 1) {
        throw new HttpError(400, 'A board needs at least one column');
    }

    db.prepare('DELETE FROM statuses WHERE id = ?').run(id);
}

import { PRIORITY_VALUES } from '@/lib/constants';
import { formatTime } from '@/lib/format';

import { getDb, transaction } from './db';
import { HttpError } from './http';
import { requireStatus } from './projects';
import * as validate from './validation';

/**
 * @typedef {Object} TaskSummary
 * @property {number} id
 * @property {number} projectId
 * @property {number} statusId
 * @property {string} title
 * @property {import('@/lib/constants').Priority} priority
 * @property {number|null} assigneeId
 * @property {string|null} dueDate
 * @property {number|null} estimateHours
 * @property {number} position
 * @property {number} hoursLogged
 * @property {number} commentCount
 * @property {string|null} completedAt
 */

/**
 * @typedef {Object} Comment
 * @property {number} id
 * @property {number|null} userId
 * @property {string} userName
 * @property {string} body
 * @property {string} createdAt
 */

/**
 * @typedef {Object} TimeEntry
 * @property {number} id
 * @property {number} userId
 * @property {string} userName
 * @property {number} hours
 * @property {string} note
 * @property {string} date
 * @property {string|null} startTime - `HH:MM`, only for entries logged as a time range.
 * @property {string|null} endTime
 */

/**
 * @typedef {TaskSummary & {
 *   description: string,
 *   creatorName: string|null,
 *   createdAt: string,
 *   comments: Comment[],
 *   timeEntries: TimeEntry[],
 * }} TaskDetail
 */

const SUMMARY_SELECT = `
    SELECT t.*,
           (SELECT COALESCE(SUM(hours), 0) FROM time_entries WHERE task_id = t.id) AS hours_logged,
           (SELECT COUNT(*) FROM comments WHERE task_id = t.id) AS comment_count
    FROM tasks t
`;

/**
 * Validates the editable task fields present in a request body.
 * Fields that weren't sent are left undefined so updates skip them.
 *
 * @param {Record<string, unknown>} data
 * @returns {{
 *   title?: string,
 *   description?: string,
 *   priority?: import('@/lib/constants').Priority,
 *   assigneeId?: number|null,
 *   dueDate?: string|null,
 *   estimateHours?: number|null,
 *   statusId?: number,
 * }}
 */
export function parseTaskInput(data) {
    const input = {};

    if (validate.has(data, 'title')) {
        input.title = validate.string(data.title, 'Title', { min: 1, max: 200 });
    }

    if (validate.has(data, 'description')) {
        input.description = validate.string(data.description, 'Description', { max: 10000 });
    }

    if (validate.has(data, 'priority')) {
        input.priority = validate.oneOf(data.priority, 'Priority', PRIORITY_VALUES);
    }

    if (validate.has(data, 'assigneeId')) {
        input.assigneeId = validate.id(data.assigneeId, 'Assignee', { nullable: true });

        if (input.assigneeId !== null) {
            const assignee = getDb()
                .prepare('SELECT id FROM users WHERE id = ? AND is_active = 1')
                .get(input.assigneeId);

            if (!assignee) {
                throw new HttpError(400, 'Assignee is not an active user');
            }
        }
    }

    if (validate.has(data, 'dueDate')) {
        input.dueDate = validate.date(data.dueDate, 'Due date', { nullable: true });
    }

    if (validate.has(data, 'estimateHours')) {
        input.estimateHours = validate.number(data.estimateHours, 'Estimate', { min: 0, max: 10000, nullable: true });
    }

    if (validate.has(data, 'statusId')) {
        input.statusId = validate.id(data.statusId, 'Status');
    }

    return input;
}

/**
 * @param {Object} row
 * @returns {TaskSummary}
 */
function toTaskSummary(row) {
    return {
        id: row.id,
        projectId: row.project_id,
        statusId: row.status_id,
        title: row.title,
        priority: row.priority,
        assigneeId: row.assignee_id,
        dueDate: row.due_date,
        estimateHours: row.estimate_hours,
        position: row.position,
        hoursLogged: row.hours_logged,
        commentCount: row.comment_count,
        completedAt: row.completed_at,
    };
}

/**
 * @param {number} projectId
 * @returns {TaskSummary[]}
 */
export function listBoardTasks(projectId) {
    return getDb()
        .prepare(`${SUMMARY_SELECT} WHERE t.project_id = ? ORDER BY t.position, t.id`)
        .all(projectId)
        .map(toTaskSummary);
}

/**
 * @param {number} id
 * @returns {TaskSummary}
 */
export function getTaskSummary(id) {
    const row = getDb().prepare(`${SUMMARY_SELECT} WHERE t.id = ?`).get(id);

    if (!row) {
        throw new HttpError(404, 'Task not found');
    }

    return toTaskSummary(row);
}

/**
 * Loads a task with its comments and time entries.
 *
 * @param {number} id
 * @returns {TaskDetail}
 */
export function getTaskDetail(id) {
    const db = getDb();
    const summary = getTaskSummary(id);
    const row = db
        .prepare(
            `SELECT t.description, t.created_at, u.name AS creator_name
             FROM tasks t LEFT JOIN users u ON u.id = t.creator_id
             WHERE t.id = ?`
        )
        .get(id);

    const comments = db
        .prepare(
            `SELECT c.id, c.user_id, c.body, c.created_at, COALESCE(u.name, 'Deleted user') AS user_name
             FROM comments c LEFT JOIN users u ON u.id = c.user_id
             WHERE c.task_id = ? ORDER BY c.created_at, c.id`
        )
        .all(id)
        .map((comment) => ({
            id: comment.id,
            userId: comment.user_id,
            userName: comment.user_name,
            body: comment.body,
            createdAt: comment.created_at,
        }));

    const timeEntries = db
        .prepare(
            `SELECT te.id, te.user_id, te.hours, te.note, te.date, te.start_time, te.end_time, u.name AS user_name
             FROM time_entries te JOIN users u ON u.id = te.user_id
             WHERE te.task_id = ? ORDER BY te.date DESC, te.start_time DESC, te.id DESC`
        )
        .all(id)
        .map((entry) => ({
            id: entry.id,
            userId: entry.user_id,
            userName: entry.user_name,
            hours: entry.hours,
            note: entry.note,
            date: entry.date,
            startTime: entry.start_time,
            endTime: entry.end_time,
        }));

    return {
        ...summary,
        description: row.description,
        creatorName: row.creator_name,
        createdAt: row.created_at,
        comments,
        timeEntries,
    };
}

/**
 * @param {number} statusId
 * @returns {number}
 */
function nextPosition(statusId) {
    return getDb()
        .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks WHERE status_id = ?')
        .get(statusId).next;
}

/**
 * Creates a task at the bottom of a column.
 *
 * @param {Object} data
 * @param {number} data.statusId
 * @param {string} data.title
 * @param {number} data.creatorId
 * @param {string} [data.description]
 * @param {import('@/lib/constants').Priority} [data.priority]
 * @param {number|null} [data.assigneeId]
 * @param {string|null} [data.dueDate]
 * @param {number|null} [data.estimateHours]
 * @returns {TaskSummary}
 */
export function createTask({
    statusId,
    title,
    creatorId,
    description = '',
    priority = 'normal',
    assigneeId = null,
    dueDate = null,
    estimateHours = null,
}) {
    const status = requireStatus(statusId);
    const result = getDb()
        .prepare(
            `INSERT INTO tasks
                (project_id, status_id, title, description, priority, assignee_id, creator_id,
                 due_date, estimate_hours, position, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN datetime('now') END)`
        )
        .run(
            status.projectId,
            statusId,
            title,
            description,
            priority,
            assigneeId,
            creatorId,
            dueDate,
            estimateHours,
            nextPosition(statusId),
            status.isDone ? 1 : 0
        );

    return getTaskSummary(Number(result.lastInsertRowid));
}

/**
 * Keeps `completed_at` in sync when a task changes column.
 *
 * @param {number} taskId
 * @param {number} statusId
 * @returns {void}
 */
function syncCompletion(taskId, statusId) {
    const status = requireStatus(statusId);

    getDb()
        .prepare(
            `UPDATE tasks SET completed_at = CASE
                WHEN ? THEN COALESCE(completed_at, datetime('now'))
                ELSE NULL
             END
             WHERE id = ?`
        )
        .run(status.isDone ? 1 : 0, taskId);
}

/**
 * Updates task fields. Changing `statusId` here drops the task at the
 * bottom of the new column; use `moveTask` to place it precisely.
 *
 * @param {number} id
 * @param {Object} changes
 * @param {string} [changes.title]
 * @param {string} [changes.description]
 * @param {import('@/lib/constants').Priority} [changes.priority]
 * @param {number|null} [changes.assigneeId]
 * @param {string|null} [changes.dueDate]
 * @param {number|null} [changes.estimateHours]
 * @param {number} [changes.statusId]
 * @returns {TaskSummary}
 */
export function updateTask(id, changes) {
    return transaction(() => {
        const task = getTaskSummary(id);
        const columns = [];
        const values = [];
        const mapping = {
            title: 'title',
            description: 'description',
            priority: 'priority',
            assigneeId: 'assignee_id',
            dueDate: 'due_date',
            estimateHours: 'estimate_hours',
        };

        for (const [key, column] of Object.entries(mapping)) {
            if (changes[key] !== undefined) {
                columns.push(`${column} = ?`);
                values.push(changes[key]);
            }
        }

        if (changes.statusId !== undefined && changes.statusId !== task.statusId) {
            const status = requireStatus(changes.statusId);

            if (status.projectId !== task.projectId) {
                throw new HttpError(400, 'That column belongs to another board');
            }

            columns.push('status_id = ?', 'position = ?');
            values.push(changes.statusId, nextPosition(changes.statusId));
        }

        if (columns.length > 0) {
            columns.push("updated_at = datetime('now')");
            getDb().prepare(`UPDATE tasks SET ${columns.join(', ')} WHERE id = ?`).run(...values, id);
        }

        if (changes.statusId !== undefined) {
            syncCompletion(id, changes.statusId);
        }

        return getTaskSummary(id);
    });
}

/**
 * Moves a task to `index` within a column and renumbers that column.
 *
 * @param {number} id
 * @param {number} statusId
 * @param {number} index
 * @returns {TaskSummary}
 */
export function moveTask(id, statusId, index) {
    return transaction(() => {
        const db = getDb();
        const task = getTaskSummary(id);
        const status = requireStatus(statusId);

        if (status.projectId !== task.projectId) {
            throw new HttpError(400, 'That column belongs to another board');
        }

        const siblings = db
            .prepare('SELECT id FROM tasks WHERE status_id = ? AND id != ? ORDER BY position, id')
            .all(statusId, id)
            .map((row) => row.id);
        const clampedIndex = Math.max(0, Math.min(index, siblings.length));

        siblings.splice(clampedIndex, 0, id);

        const update = db.prepare("UPDATE tasks SET status_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?");
        siblings.forEach((taskId, position) => update.run(statusId, position, taskId));

        syncCompletion(id, statusId);

        return getTaskSummary(id);
    });
}

/**
 * @param {number} id
 * @returns {void}
 */
export function deleteTask(id) {
    getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

/**
 * @param {number} taskId
 * @param {number} userId
 * @param {string} body
 * @returns {void}
 */
export function addComment(taskId, userId, body) {
    getTaskSummary(taskId);
    getDb().prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)').run(taskId, userId, body);
}

/**
 * Logs time on a task, either as a plain duration or as a start–end range.
 * A range may not overlap another range the same person logged that day,
 * on any task. Ranges that only touch (10:00–11:00 then 11:00–12:00) are fine.
 *
 * @param {number} taskId
 * @param {Object} data
 * @param {number} data.userId
 * @param {number} data.hours
 * @param {string} data.date
 * @param {string} data.note
 * @param {string|null} [data.startTime] - `HH:MM`
 * @param {string|null} [data.endTime] - `HH:MM`, after `startTime`.
 * @returns {void}
 */
export function addTimeEntry(taskId, { userId, hours, date, note, startTime = null, endTime = null }) {
    transaction(() => {
        const db = getDb();

        getTaskSummary(taskId);

        if (startTime && endTime) {
            // Zero-padded HH:MM strings compare correctly as text.
            const conflict = db
                .prepare(
                    `SELECT te.start_time, te.end_time, t.title
                     FROM time_entries te JOIN tasks t ON t.id = te.task_id
                     WHERE te.user_id = ? AND te.date = ?
                       AND te.start_time IS NOT NULL
                       AND te.start_time < ? AND te.end_time > ?
                     ORDER BY te.start_time
                     LIMIT 1`
                )
                .get(userId, date, endTime, startTime);

            if (conflict) {
                throw new HttpError(
                    409,
                    `That overlaps time you already logged on “${conflict.title}” ` +
                        `(${formatTime(conflict.start_time)}–${formatTime(conflict.end_time)})`
                );
            }
        }

        db.prepare(
            'INSERT INTO time_entries (task_id, user_id, hours, date, note, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(taskId, userId, hours, date, note, startTime, endTime);
    });
}

/**
 * Deletes a time entry. Members may only delete their own.
 *
 * @param {number} id
 * @param {import('./auth').SessionUser} user
 * @returns {number} The task id the entry belonged to.
 */
export function deleteTimeEntry(id, user) {
    const db = getDb();
    const entry = db.prepare('SELECT task_id, user_id FROM time_entries WHERE id = ?').get(id);

    if (!entry) {
        throw new HttpError(404, 'Time entry not found');
    }

    if (entry.user_id !== user.id && user.role !== 'admin') {
        throw new HttpError(403, 'You can only remove your own time');
    }

    db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);

    return entry.task_id;
}

/**
 * Open tasks assigned to a user, soonest due first, with board info.
 *
 * @param {number} userId
 * @returns {(TaskSummary & { projectName: string, projectColor: string, statusName: string, statusColor: string })[]}
 */
export function listAssignedTasks(userId) {
    return getDb()
        .prepare(
            `SELECT t.*, p.name AS project_name, p.color AS project_color,
                    s.name AS status_name, s.color AS status_color,
                    (SELECT COALESCE(SUM(hours), 0) FROM time_entries WHERE task_id = t.id) AS hours_logged,
                    (SELECT COUNT(*) FROM comments WHERE task_id = t.id) AS comment_count
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             JOIN statuses s ON s.id = t.status_id
             WHERE t.assignee_id = ? AND t.completed_at IS NULL
             ORDER BY t.due_date IS NULL, t.due_date,
                      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`
        )
        .all(userId)
        .map((row) => ({
            ...toTaskSummary(row),
            projectName: row.project_name,
            projectColor: row.project_color,
            statusName: row.status_name,
            statusColor: row.status_color,
        }));
}

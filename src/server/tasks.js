import { PRIORITY_VALUES } from '@/lib/constants';
import { formatTime } from '@/lib/format';

import { collection, insertWithId, setPositions, toISO } from './db';
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
 * @property {string|null} completedAt - ISO timestamp.
 */

/**
 * @typedef {Object} Comment
 * @property {number} id
 * @property {number|null} userId
 * @property {string} userName
 * @property {string} body
 * @property {string} createdAt - ISO timestamp.
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

const PRIORITY_RANK = Object.fromEntries(PRIORITY_VALUES.map((value, index) => [value, index]));

/**
 * Validates the editable task fields present in a request body.
 * Fields that weren't sent are left undefined so updates skip them.
 *
 * @param {Record<string, unknown>} data
 * @returns {Promise<{
 *   title?: string,
 *   description?: string,
 *   priority?: import('@/lib/constants').Priority,
 *   assigneeId?: number|null,
 *   dueDate?: string|null,
 *   estimateHours?: number|null,
 *   statusId?: number,
 * }>}
 */
export async function parseTaskInput(data) {
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
            const assignee = await (await collection('users')).findOne({ _id: input.assigneeId, isActive: true });

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
 * Adds logged hours and comment counts to task documents.
 *
 * @param {Object[]} docs
 * @returns {Promise<TaskSummary[]>}
 */
async function toTaskSummaries(docs) {
    const ids = docs.map((doc) => doc._id);
    const [hours, comments] = await Promise.all([
        (await collection('timeEntries'))
            .aggregate([{ $match: { taskId: { $in: ids } } }, { $group: { _id: '$taskId', total: { $sum: '$hours' } } }])
            .toArray(),
        (await collection('comments'))
            .aggregate([{ $match: { taskId: { $in: ids } } }, { $group: { _id: '$taskId', total: { $sum: 1 } } }])
            .toArray(),
    ]);
    const hoursById = new Map(hours.map((row) => [row._id, Math.round(row.total * 100) / 100]));
    const commentsById = new Map(comments.map((row) => [row._id, row.total]));

    return docs.map((doc) => ({
        id: doc._id,
        projectId: doc.projectId,
        statusId: doc.statusId,
        title: doc.title,
        priority: doc.priority,
        assigneeId: doc.assigneeId,
        dueDate: doc.dueDate,
        estimateHours: doc.estimateHours,
        position: doc.position,
        hoursLogged: hoursById.get(doc._id) ?? 0,
        commentCount: commentsById.get(doc._id) ?? 0,
        completedAt: toISO(doc.completedAt),
    }));
}

/**
 * @param {number} id
 * @returns {Promise<Object>} The raw task document.
 */
async function requireTaskDoc(id) {
    const doc = await (await collection('tasks')).findOne({ _id: id });

    if (!doc) {
        throw new HttpError(404, 'Task not found');
    }

    return doc;
}

/**
 * @param {number[]} ids
 * @returns {Promise<Map<number, string>>} User id to name.
 */
async function userNames(ids) {
    const users = await (await collection('users'))
        .find({ _id: { $in: [...new Set(ids)] } }, { projection: { name: 1 } })
        .toArray();

    return new Map(users.map((user) => [user._id, user.name]));
}

/**
 * @param {number} projectId
 * @returns {Promise<TaskSummary[]>}
 */
export async function listBoardTasks(projectId) {
    const docs = await (await collection('tasks')).find({ projectId }).sort({ position: 1, _id: 1 }).toArray();

    return toTaskSummaries(docs);
}

/**
 * @param {number} id
 * @returns {Promise<TaskSummary>}
 */
export async function getTaskSummary(id) {
    const [summary] = await toTaskSummaries([await requireTaskDoc(id)]);

    return summary;
}

/**
 * Loads a task with its comments and time entries.
 *
 * @param {number} id
 * @returns {Promise<TaskDetail>}
 */
export async function getTaskDetail(id) {
    const doc = await requireTaskDoc(id);
    const [[summary], comments, timeEntries] = await Promise.all([
        toTaskSummaries([doc]),
        (await collection('comments')).find({ taskId: id }).sort({ createdAt: 1, _id: 1 }).toArray(),
        (await collection('timeEntries')).find({ taskId: id }).sort({ date: -1, startTime: -1, _id: -1 }).toArray(),
    ]);
    const names = await userNames([
        doc.creatorId,
        ...comments.map((comment) => comment.userId),
        ...timeEntries.map((entry) => entry.userId),
    ]);

    return {
        ...summary,
        description: doc.description,
        creatorName: names.get(doc.creatorId) ?? null,
        createdAt: toISO(doc.createdAt),
        comments: comments.map((comment) => ({
            id: comment._id,
            userId: comment.userId,
            userName: names.get(comment.userId) ?? 'Deleted user',
            body: comment.body,
            createdAt: toISO(comment.createdAt),
        })),
        timeEntries: timeEntries.map((entry) => ({
            id: entry._id,
            userId: entry.userId,
            userName: names.get(entry.userId) ?? 'Deleted user',
            hours: entry.hours,
            note: entry.note,
            date: entry.date,
            startTime: entry.startTime ?? null,
            endTime: entry.endTime ?? null,
        })),
    };
}

/**
 * @param {number} statusId
 * @returns {Promise<number>}
 */
async function nextPosition(statusId) {
    const last = await (await collection('tasks')).findOne({ statusId }, { sort: { position: -1 } });

    return last ? last.position + 1 : 0;
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
 * @returns {Promise<TaskSummary>}
 */
export async function createTask({
    statusId,
    title,
    creatorId,
    description = '',
    priority = 'normal',
    assigneeId = null,
    dueDate = null,
    estimateHours = null,
}) {
    const status = await requireStatus(statusId);
    const now = new Date();
    const id = await insertWithId('tasks', {
        projectId: status.projectId,
        statusId,
        title,
        description,
        priority,
        assigneeId,
        creatorId,
        dueDate,
        estimateHours,
        position: await nextPosition(statusId),
        createdAt: now,
        updatedAt: now,
        completedAt: status.isDone ? now : null,
    });

    return getTaskSummary(id);
}

/**
 * Keeps `completedAt` in sync when a task changes column.
 *
 * @param {number} taskId
 * @param {number} statusId
 * @returns {Promise<void>}
 */
async function syncCompletion(taskId, statusId) {
    const status = await requireStatus(statusId);
    const tasks = await collection('tasks');

    if (status.isDone) {
        await tasks.updateOne({ _id: taskId, completedAt: null }, { $set: { completedAt: new Date() } });
    } else {
        await tasks.updateOne({ _id: taskId }, { $set: { completedAt: null } });
    }
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
 * @returns {Promise<TaskSummary>}
 */
export async function updateTask(id, changes) {
    const task = await requireTaskDoc(id);
    const update = {};

    for (const key of ['title', 'description', 'priority', 'assigneeId', 'dueDate', 'estimateHours']) {
        if (changes[key] !== undefined) {
            update[key] = changes[key];
        }
    }

    if (changes.statusId !== undefined && changes.statusId !== task.statusId) {
        const status = await requireStatus(changes.statusId);

        if (status.projectId !== task.projectId) {
            throw new HttpError(400, 'That column belongs to another board');
        }

        update.statusId = changes.statusId;
        update.position = await nextPosition(changes.statusId);
    }

    if (Object.keys(update).length > 0) {
        update.updatedAt = new Date();
        await (await collection('tasks')).updateOne({ _id: id }, { $set: update });
    }

    if (changes.statusId !== undefined) {
        await syncCompletion(id, changes.statusId);
    }

    return getTaskSummary(id);
}

/**
 * Moves a task to `index` within a column and renumbers that column.
 *
 * @param {number} id
 * @param {number} statusId
 * @param {number} index
 * @returns {Promise<TaskSummary>}
 */
export async function moveTask(id, statusId, index) {
    const task = await requireTaskDoc(id);
    const status = await requireStatus(statusId);

    if (status.projectId !== task.projectId) {
        throw new HttpError(400, 'That column belongs to another board');
    }

    const tasks = await collection('tasks');
    const siblings = await tasks.find({ statusId, _id: { $ne: id } }).sort({ position: 1, _id: 1 }).toArray();
    const ordered = siblings.map((doc) => doc._id);

    ordered.splice(Math.max(0, Math.min(index, ordered.length)), 0, id);

    await setPositions('tasks', ordered, { statusId });
    await tasks.updateOne({ _id: id }, { $set: { updatedAt: new Date() } });
    await syncCompletion(id, statusId);

    return getTaskSummary(id);
}

/**
 * Deletes a task with its comments and time entries.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteTask(id) {
    await Promise.all([
        (await collection('timeEntries')).deleteMany({ taskId: id }),
        (await collection('comments')).deleteMany({ taskId: id }),
    ]);
    await (await collection('tasks')).deleteOne({ _id: id });
}

/**
 * @param {number} taskId
 * @param {number} userId
 * @param {string} body
 * @returns {Promise<void>}
 */
export async function addComment(taskId, userId, body) {
    await requireTaskDoc(taskId);
    await insertWithId('comments', { taskId, userId, body, createdAt: new Date() });
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
 * @returns {Promise<void>}
 */
export async function addTimeEntry(taskId, { userId, hours, date, note, startTime = null, endTime = null }) {
    await requireTaskDoc(taskId);

    if (startTime && endTime) {
        // Zero-padded HH:MM strings compare correctly as text.
        const conflict = await (await collection('timeEntries')).findOne(
            { userId, date, startTime: { $ne: null, $lt: endTime }, endTime: { $gt: startTime } },
            { sort: { startTime: 1 } }
        );

        if (conflict) {
            const conflictTask = await (await collection('tasks')).findOne({ _id: conflict.taskId });

            throw new HttpError(
                409,
                `That overlaps time you already logged on “${conflictTask?.title ?? 'another task'}” ` +
                    `(${formatTime(conflict.startTime)}–${formatTime(conflict.endTime)})`
            );
        }
    }

    await insertWithId('timeEntries', {
        taskId,
        userId,
        hours,
        date,
        note,
        startTime,
        endTime,
        createdAt: new Date(),
    });
}

/**
 * Deletes a time entry. Members may only delete their own.
 *
 * @param {number} id
 * @param {import('./auth').SessionUser} user
 * @returns {Promise<number>} The task id the entry belonged to.
 */
export async function deleteTimeEntry(id, user) {
    const timeEntries = await collection('timeEntries');
    const entry = await timeEntries.findOne({ _id: id });

    if (!entry) {
        throw new HttpError(404, 'Time entry not found');
    }

    if (entry.userId !== user.id && user.role !== 'admin') {
        throw new HttpError(403, 'You can only remove your own time');
    }

    await timeEntries.deleteOne({ _id: id });

    return entry.taskId;
}

/**
 * Sorts tasks by due date (undated last), then by priority.
 *
 * @param {TaskSummary} a
 * @param {TaskSummary} b
 * @returns {number}
 */
function compareByDueThenPriority(a, b) {
    if (a.dueDate === b.dueDate) {
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }

    if (!a.dueDate || !b.dueDate) {
        return a.dueDate ? -1 : 1;
    }

    return a.dueDate < b.dueDate ? -1 : 1;
}

/**
 * Open tasks assigned to a user, soonest due first, with board info.
 *
 * @param {number} userId
 * @returns {Promise<(TaskSummary & { projectName: string, projectColor: string, statusName: string, statusColor: string })[]>}
 */
export async function listAssignedTasks(userId) {
    const docs = await (await collection('tasks')).find({ assigneeId: userId, completedAt: null }).toArray();
    const [summaries, projects, statuses] = await Promise.all([
        toTaskSummaries(docs),
        (await collection('projects')).find({ _id: { $in: docs.map((doc) => doc.projectId) } }).toArray(),
        (await collection('statuses')).find({ _id: { $in: docs.map((doc) => doc.statusId) } }).toArray(),
    ]);
    const projectsById = new Map(projects.map((project) => [project._id, project]));
    const statusesById = new Map(statuses.map((status) => [status._id, status]));

    return summaries
        .map((task) => ({
            ...task,
            projectName: projectsById.get(task.projectId)?.name ?? '',
            projectColor: projectsById.get(task.projectId)?.color ?? '#898781',
            statusName: statusesById.get(task.statusId)?.name ?? '',
            statusColor: statusesById.get(task.statusId)?.color ?? '#898781',
        }))
        .sort(compareByDueThenPriority);
}

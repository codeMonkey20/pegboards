import { DEFAULT_STATUSES } from '@/lib/constants';

import { collection, insertWithId, nextId, setPositions } from './db';
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

const BY_NAME = { locale: 'en', strength: 2 };

/**
 * @param {Object} doc
 * @returns {Project}
 */
function toProject(doc) {
    return { id: doc._id, name: doc.name, description: doc.description, color: doc.color };
}

/**
 * @param {Object} doc
 * @returns {Status}
 */
function toStatus(doc) {
    return {
        id: doc._id,
        projectId: doc.projectId,
        name: doc.name,
        color: doc.color,
        position: doc.position,
        isDone: doc.isDone,
    };
}

/**
 * Lists boards with task counts for the boards overview.
 *
 * @returns {Promise<(Project & { taskCount: number, openCount: number })[]>}
 */
export async function listProjects() {
    const [projects, counts] = await Promise.all([
        (await collection('projects')).find().collation(BY_NAME).sort({ name: 1 }).toArray(),
        (await collection('tasks'))
            .aggregate([
                {
                    $group: {
                        _id: '$projectId',
                        taskCount: { $sum: 1 },
                        openCount: { $sum: { $cond: [{ $eq: ['$completedAt', null] }, 1, 0] } },
                    },
                },
            ])
            .toArray(),
    ]);
    const countsById = new Map(counts.map((count) => [count._id, count]));

    return projects.map((doc) => ({
        ...toProject(doc),
        taskCount: countsById.get(doc._id)?.taskCount ?? 0,
        openCount: countsById.get(doc._id)?.openCount ?? 0,
    }));
}

/**
 * @param {number} id
 * @returns {Promise<Project|null>}
 */
export async function getProject(id) {
    const doc = await (await collection('projects')).findOne({ _id: id });

    return doc ? toProject(doc) : null;
}

/**
 * @param {number} id
 * @returns {Promise<Project>}
 */
export async function requireProject(id) {
    const project = await getProject(id);

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
 * @returns {Promise<number>} The new board's id.
 */
export async function createProject({ name, description, color, createdBy }) {
    const projectId = await insertWithId('projects', { name, description, color, createdBy, createdAt: new Date() });
    const statusDocs = [];

    for (const [position, status] of DEFAULT_STATUSES.entries()) {
        statusDocs.push({
            _id: await nextId('statuses'),
            projectId,
            name: status.name,
            color: status.color,
            position,
            isDone: status.isDone,
        });
    }

    await (await collection('statuses')).insertMany(statusDocs);

    return projectId;
}

/**
 * @param {number} id
 * @param {{ name?: string, description?: string, color?: string }} changes
 * @returns {Promise<void>}
 */
export async function updateProject(id, changes) {
    const update = {};

    for (const key of ['name', 'description', 'color']) {
        if (changes[key] !== undefined) {
            update[key] = changes[key];
        }
    }

    if (Object.keys(update).length > 0) {
        await (await collection('projects')).updateOne({ _id: id }, { $set: update });
    }
}

/**
 * Deletes a board and everything on it.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
    const tasks = await collection('tasks');
    const taskIds = await tasks.distinct('_id', { projectId: id });

    await Promise.all([
        (await collection('timeEntries')).deleteMany({ taskId: { $in: taskIds } }),
        (await collection('comments')).deleteMany({ taskId: { $in: taskIds } }),
    ]);
    await tasks.deleteMany({ projectId: id });
    await (await collection('statuses')).deleteMany({ projectId: id });
    await (await collection('projects')).deleteOne({ _id: id });
}

/**
 * @param {number} projectId
 * @returns {Promise<Status[]>}
 */
export async function listStatuses(projectId) {
    const docs = await (await collection('statuses')).find({ projectId }).sort({ position: 1, _id: 1 }).toArray();

    return docs.map(toStatus);
}

/**
 * @param {number} id
 * @returns {Promise<Status>}
 */
export async function requireStatus(id) {
    const doc = await (await collection('statuses')).findOne({ _id: id });

    if (!doc) {
        throw new HttpError(404, 'Column not found');
    }

    return toStatus(doc);
}

/**
 * Adds a column to the end of a board.
 *
 * @param {number} projectId
 * @param {{ name: string, color: string, isDone: boolean }} data
 * @returns {Promise<Status>}
 */
export async function createStatus(projectId, { name, color, isDone }) {
    const last = await (await collection('statuses')).findOne({ projectId }, { sort: { position: -1 } });
    const id = await insertWithId('statuses', {
        projectId,
        name,
        color,
        position: last ? last.position + 1 : 0,
        isDone,
    });

    return requireStatus(id);
}

/**
 * Updates a column. Toggling "done" also stamps or clears completion
 * dates on its tasks so completion metrics stay accurate.
 *
 * @param {number} id
 * @param {{ name?: string, color?: string, isDone?: boolean }} changes
 * @returns {Promise<Status>}
 */
export async function updateStatus(id, changes) {
    const current = await requireStatus(id);
    const update = {};

    for (const key of ['name', 'color', 'isDone']) {
        if (changes[key] !== undefined) {
            update[key] = changes[key];
        }
    }

    if (Object.keys(update).length > 0) {
        await (await collection('statuses')).updateOne({ _id: id }, { $set: update });
    }

    if (changes.isDone !== undefined && changes.isDone !== current.isDone) {
        const tasks = await collection('tasks');

        if (changes.isDone) {
            await tasks.updateMany({ statusId: id, completedAt: null }, { $set: { completedAt: new Date() } });
        } else {
            await tasks.updateMany({ statusId: id }, { $set: { completedAt: null } });
        }
    }

    return requireStatus(id);
}

/**
 * Moves a column one place left or right.
 *
 * @param {number} id
 * @param {-1|1} direction
 * @returns {Promise<Status[]>} The board's columns in their new order.
 */
export async function moveStatus(id, direction) {
    const status = await requireStatus(id);
    const ids = (await listStatuses(status.projectId)).map((item) => item.id);
    const index = ids.indexOf(id);
    const target = index + direction;

    if (target >= 0 && target < ids.length) {
        [ids[index], ids[target]] = [ids[target], ids[index]];
        await setPositions('statuses', ids);
    }

    return listStatuses(status.projectId);
}

/**
 * Deletes an empty column.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteStatus(id) {
    const status = await requireStatus(id);
    const [taskCount, statusCount] = await Promise.all([
        (await collection('tasks')).countDocuments({ statusId: id }),
        (await collection('statuses')).countDocuments({ projectId: status.projectId }),
    ]);

    if (taskCount > 0) {
        throw new HttpError(400, 'Move or delete the tasks in this column first');
    }

    if (statusCount <= 1) {
        throw new HttpError(400, 'A board needs at least one column');
    }

    await (await collection('statuses')).deleteOne({ _id: id });
}

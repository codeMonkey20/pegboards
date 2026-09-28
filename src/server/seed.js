import { addDays, toISODate } from '@/lib/dates';

import { collection, reserveIds } from './db';
import { createDashboard, createWidget } from './dashboards';
import { createProject, listStatuses } from './projects';
import { createUser } from './users';

export const DEMO_PASSWORD = 'demo1234';

const DEMO_USERS = [
    { name: 'Ava Santos', email: 'ava@example.com' },
    { name: 'Ben Okafor', email: 'ben@example.com' },
    { name: 'Chloe Tan', email: 'chloe@example.com' },
    { name: 'Diego Ramos', email: 'diego@example.com' },
];

const DEMO_BOARDS = [
    {
        name: 'Website redesign',
        description: 'New marketing site, launching next quarter.',
        color: '#2a78d6',
        tasks: [
            'Audit current site analytics',
            'Wireframe homepage',
            'Design system: colors & type',
            'Build navigation component',
            'Write pricing page copy',
            'Set up CMS content models',
            'Migrate blog posts',
            'Accessibility review',
            'SEO redirects map',
            'Performance budget',
            'Contact form integration',
            'Launch checklist',
        ],
    },
    {
        name: 'Mobile app',
        description: 'iOS and Android client, v2.',
        color: '#1baf7a',
        tasks: [
            'Onboarding flow',
            'Push notification service',
            'Offline sync',
            'Crash reporting',
            'Dark mode',
            'App store screenshots',
            'Biometric sign-in',
            'Settings screen',
            'Beta feedback triage',
            'Release notes v2.0',
        ],
    },
    {
        name: 'Client support',
        description: 'Recurring client requests and fixes.',
        color: '#eb6834',
        tasks: [
            'Monthly report for Acme',
            'Fix broken checkout link',
            'Update footer legal text',
            'Quarterly review deck',
            'Onboard new client contact',
            'Investigate slow dashboard',
        ],
    },
];

const PRIORITIES = ['urgent', 'high', 'normal', 'normal', 'normal', 'low'];

/**
 * Small deterministic PRNG so demo data looks the same on every install.
 *
 * @param {number} seed
 * @returns {() => number}
 */
function random(seed) {
    let state = seed;

    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

/**
 * `insertMany` rejects an empty list, which a small seed can produce.
 *
 * @param {string} name
 * @param {Object[]} docs
 * @returns {Promise<void>}
 */
async function insertAll(name, docs) {
    if (docs.length > 0) {
        await (await collection(name)).insertMany(docs);
    }
}

/**
 * Fills a fresh workspace with teammates, boards, tasks, time entries
 * and a starter dashboard, so the metrics have something to show.
 *
 * @param {number} adminId
 * @returns {Promise<void>}
 */
export async function seedDemoData(adminId) {
    const next = random(42);
    const pick = (items) => items[Math.floor(next() * items.length)];
    const now = new Date();
    const userIds = [adminId];

    for (const user of DEMO_USERS) {
        userIds.push(await createUser({ ...user, password: DEMO_PASSWORD }));
    }

    const tasks = [];
    const timeEntries = [];
    const comments = [];

    for (const board of DEMO_BOARDS) {
        const projectId = await createProject({
            name: board.name,
            description: board.description,
            color: board.color,
            createdBy: adminId,
        });
        const statuses = await listStatuses(projectId);
        const taskIds = await reserveIds('tasks', board.tasks.length);
        const positions = new Map();

        board.tasks.forEach((title, index) => {
            const taskId = taskIds[index];
            const status = pick(statuses);
            const assigneeId = next() < 0.1 ? null : pick(userIds);
            const createdDaysAgo = Math.floor(next() * 75) + 3;
            const created = addDays(now, -createdDaysAgo);
            const completed = status.isDone ? addDays(created, Math.floor(next() * (createdDaysAgo - 1)) + 1) : null;
            const dueDate = next() < 0.8 ? toISODate(addDays(now, Math.floor(next() * 30) - 10)) : null;
            const estimate = Math.round((next() * 14 + 1) * 2) / 2;
            const position = positions.get(status.id) ?? 0;

            positions.set(status.id, position + 1);

            tasks.push({
                _id: taskId,
                projectId,
                statusId: status.id,
                title,
                description: '',
                priority: pick(PRIORITIES),
                assigneeId,
                creatorId: adminId,
                dueDate,
                estimateHours: estimate,
                position,
                createdAt: created,
                updatedAt: created,
                completedAt: completed,
            });

            if (status.position > 0) {
                const entries = Math.floor(next() * 6) + 1;
                const lastDay = completed ?? now;
                const span = Math.max(1, Math.round((lastDay - created) / 86400000));

                for (let entry = 0; entry < entries; entry += 1) {
                    const day = addDays(created, Math.floor(next() * span));

                    timeEntries.push({
                        taskId,
                        userId: assigneeId ?? pick(userIds),
                        hours: Math.round((next() * 5 + 0.5) * 4) / 4,
                        note: '',
                        date: toISODate(day),
                        startTime: null,
                        endTime: null,
                        createdAt: day,
                    });
                }
            }

            if (next() < 0.4) {
                comments.push({
                    taskId,
                    userId: pick(userIds),
                    body: pick(['Picking this up today.', 'Blocked on feedback from the client.', 'Draft is ready for review.', 'Can we split this into two tasks?']),
                    createdAt: addDays(created, 1),
                });
            }
        });
    }

    const [entryIds, commentIds] = await Promise.all([
        reserveIds('timeEntries', timeEntries.length),
        reserveIds('comments', comments.length),
    ]);

    await Promise.all([
        insertAll('tasks', tasks),
        insertAll('timeEntries', timeEntries.map((entry, index) => ({ _id: entryIds[index], ...entry }))),
        insertAll('comments', comments.map((comment, index) => ({ _id: commentIds[index], ...comment }))),
    ]);

    const dashboardId = await createDashboard(adminId, 'Team overview', { isShared: true });
    const widgets = [
        { title: 'My hours this week', width: 'third', config: { metric: 'hours_logged', groupBy: 'none', chart: 'number', filters: { dateRange: 'this_week', projectIds: [], userIds: ['me'], priorities: [], completion: 'any' } } },
        { title: 'Team hours this month', width: 'third', config: { metric: 'hours_logged', groupBy: 'none', chart: 'number', filters: { dateRange: 'this_month', projectIds: [], userIds: [], priorities: [], completion: 'any' } } },
        { title: 'Overdue tasks', width: 'third', config: { metric: 'tasks_overdue', groupBy: 'none', chart: 'number', filters: { dateRange: 'all', projectIds: [], userIds: [], priorities: [], completion: 'any' } } },
        { title: 'Hours per day (last 30 days)', width: 'two_thirds', config: { metric: 'hours_logged', groupBy: 'day', chart: 'line', filters: { dateRange: 'last_30_days', projectIds: [], userIds: [], priorities: [], completion: 'any' } } },
        { title: 'Hours by person (this month)', width: 'third', config: { metric: 'hours_logged', groupBy: 'user', chart: 'bar', filters: { dateRange: 'this_month', projectIds: [], userIds: [], priorities: [], completion: 'any' } } },
        { title: 'Open tasks by board', width: 'half', config: { metric: 'tasks_open', groupBy: 'project', chart: 'bar', filters: { dateRange: 'all', projectIds: [], userIds: [], priorities: [], completion: 'any' } } },
        { title: 'Completed per week', width: 'half', config: { metric: 'tasks_completed', groupBy: 'week', chart: 'bar', filters: { dateRange: 'last_90_days', projectIds: [], userIds: [], priorities: [], completion: 'any' } } },
    ];

    // One at a time so positions follow the order above.
    for (const widget of widgets) {
        await createWidget(dashboardId, widget);
    }
}

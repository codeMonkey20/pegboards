import {
    CHART_TYPE_VALUES,
    COMPLETION_VALUES,
    DATE_RANGE_VALUES,
    DEFAULT_WIDGET_CONFIG,
    GROUP_BY_VALUES,
    ME,
    METRIC_VALUES,
    PRIORITY_VALUES,
    TIME_GROUP_BYS,
} from '@/lib/constants';
import { addDays, parseISODate, startOfWeek, toISODate } from '@/lib/dates';

import { collection } from './db';
import { HttpError } from './http';

/**
 * @typedef {import('@/lib/constants').WidgetConfig} WidgetConfig
 */

/**
 * @typedef {Object} MetricRow
 * @property {string} key
 * @property {string} label
 * @property {number|null} value
 */

/**
 * @typedef {Object} MetricResult
 * @property {number|null} total - The metric over the whole filtered set.
 * @property {number|null} previousTotal - Same metric over the preceding period, when the range is bounded.
 * @property {MetricRow[]} rows - One row per group; empty when not grouped.
 * @property {{ from: string|null, to: string|null }} range
 */

/**
 * @typedef {Object} DateRange
 * @property {string|null} from
 * @property {string|null} to
 */

/**
 * How each metric is computed. `source` picks the collection: time
 * entries (joined to their task) or tasks. `date` is the field the date
 * range filters on; `aggregate` is how per-document values combine.
 * Every query is built from these specs; user input only ever appears
 * as values inside `$match`, never as field names or operators.
 */
const METRIC_SPECS = {
    hours_logged: { source: 'time', date: 'date', value: '$hours', aggregate: 'sum', decimals: 2 },
    tasks_created: { source: 'tasks', date: 'createdAt', aggregate: 'count' },
    tasks_completed: { source: 'tasks', date: 'completedAt', aggregate: 'count', match: () => ({ completedAt: { $ne: null } }) },
    tasks_open: { source: 'tasks', date: 'createdAt', aggregate: 'count', match: () => ({ completedAt: null }) },
    tasks_overdue: {
        source: 'tasks',
        date: 'dueDate',
        aggregate: 'count',
        match: () => ({ completedAt: null, dueDate: { $ne: null, $lt: toISODate(new Date()) } }),
    },
    estimated_hours: {
        source: 'tasks',
        date: 'createdAt',
        value: { $ifNull: ['$estimateHours', 0] },
        aggregate: 'sum',
        decimals: 2,
    },
    avg_completion_days: {
        source: 'tasks',
        date: 'completedAt',
        value: { $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 86400000] },
        aggregate: 'avg',
        decimals: 1,
        match: () => ({ completedAt: { $ne: null } }),
    },
};

/** Where each groupable field lives, per source. Weeks and months are bucketed from `day` in JS. */
const FIELDS = {
    time: { user: '$userId', project: '$task.projectId', status: '$task.statusId', priority: '$task.priority', day: '$date' },
    tasks: { user: '$assigneeId', project: '$projectId', status: '$statusId', priority: '$priority', day: '$day' },
};

/** Task timestamps are Dates; they become `YYYY-MM-DD` (UTC) so they compare with range bounds. */
const DATE_FIELDS = new Set(['createdAt', 'completedAt']);

const PRIORITY_ORDER = Object.fromEntries(PRIORITY_VALUES.map((value, index) => [value, index]));
const MAX_CATEGORY_ROWS = 25;
const MAX_TIME_POINTS = 400;

/**
 * @param {unknown} value
 * @param {(item: unknown) => boolean} isValid
 * @returns {any[]}
 */
function arrayOf(value, isValid) {
    if (!Array.isArray(value)) {
        return [];
    }

    return [...new Set(value.filter(isValid))].slice(0, 50);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

/**
 * @param {unknown} value
 * @returns {string|undefined}
 */
function optionalDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/**
 * Validates a widget config from the client. Throws on invalid choices
 * so the editor can show an error.
 *
 * @param {unknown} raw
 * @returns {WidgetConfig}
 */
export function validateWidgetConfig(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new HttpError(400, 'Widget settings are missing');
    }

    const config = sanitizeWidgetConfig(raw);

    if (config.metric !== raw.metric || config.groupBy !== raw.groupBy || config.chart !== raw.chart) {
        throw new HttpError(400, 'Widget settings contain an unknown option');
    }

    if (config.filters.dateRange === 'custom' && config.filters.from && config.filters.to && config.filters.from > config.filters.to) {
        throw new HttpError(400, 'The start date must be before the end date');
    }

    return config;
}

/**
 * Coerces a stored or submitted config into a known-good shape, falling
 * back to defaults for anything unrecognised. Used when reading from the
 * database so one bad row can't break a dashboard.
 *
 * @param {any} raw
 * @returns {WidgetConfig}
 */
export function sanitizeWidgetConfig(raw) {
    const filters = raw?.filters ?? {};
    const defaults = DEFAULT_WIDGET_CONFIG;
    const chart = CHART_TYPE_VALUES.includes(raw?.chart) ? raw.chart : defaults.chart;
    const groupBy = GROUP_BY_VALUES.includes(raw?.groupBy) ? raw.groupBy : defaults.groupBy;

    /** @type {WidgetConfig} */
    const config = {
        metric: METRIC_VALUES.includes(raw?.metric) ? raw.metric : defaults.metric,
        groupBy,
        chart,
        filters: {
            dateRange: DATE_RANGE_VALUES.includes(filters.dateRange) ? filters.dateRange : defaults.filters.dateRange,
            projectIds: arrayOf(filters.projectIds, isPositiveInteger),
            userIds: arrayOf(filters.userIds, (value) => value === ME || isPositiveInteger(value)),
            priorities: arrayOf(filters.priorities, (value) => PRIORITY_VALUES.includes(value)),
            completion: COMPLETION_VALUES.includes(filters.completion) ? filters.completion : 'any',
        },
    };

    if (config.filters.dateRange === 'custom') {
        config.filters.from = optionalDate(filters.from);
        config.filters.to = optionalDate(filters.to);
    }

    return config;
}

/**
 * Resolves a named date range into inclusive `YYYY-MM-DD` bounds, plus
 * the equally long period just before it (for "vs previous" deltas).
 *
 * @param {import('@/lib/constants').WidgetFilters} filters
 * @param {Date} [now]
 * @returns {{ current: DateRange, previous: DateRange|null }}
 */
export function resolveDateRange(filters, now = new Date()) {
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    /**
     * @param {Date} from
     * @param {Date} to
     */
    const bounded = (from, to) => {
        const days = Math.round((to - from) / 86400000) + 1;

        return {
            current: { from: toISODate(from), to: toISODate(to) },
            previous: { from: toISODate(addDays(from, -days)), to: toISODate(addDays(from, -1)) },
        };
    };

    switch (filters.dateRange) {
        case 'today':
            return bounded(todayDate, todayDate);
        case 'this_week':
            return bounded(startOfWeek(todayDate), todayDate);
        case 'last_week': {
            const start = addDays(startOfWeek(todayDate), -7);
            return bounded(start, addDays(start, 6));
        }
        case 'last_7_days':
            return bounded(addDays(todayDate, -6), todayDate);
        case 'this_month':
            return bounded(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1), todayDate);
        case 'last_month': {
            const start = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
            const end = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
            const previousStart = new Date(todayDate.getFullYear(), todayDate.getMonth() - 2, 1);

            return {
                current: { from: toISODate(start), to: toISODate(end) },
                previous: { from: toISODate(previousStart), to: toISODate(addDays(start, -1)) },
            };
        }
        case 'last_30_days':
            return bounded(addDays(todayDate, -29), todayDate);
        case 'last_90_days':
            return bounded(addDays(todayDate, -89), todayDate);
        case 'this_year':
            return bounded(new Date(todayDate.getFullYear(), 0, 1), todayDate);
        case 'custom': {
            const from = filters.from ?? null;
            const to = filters.to ?? null;

            if (from && to) {
                return bounded(parseISODate(from), parseISODate(to));
            }

            return { current: { from, to }, previous: null };
        }
        default:
            return { current: { from: null, to: null }, previous: null };
    }
}

/**
 * Builds the aggregation pipeline that filters a metric's documents and
 * sums/counts them per group key.
 *
 * @param {typeof METRIC_SPECS[keyof typeof METRIC_SPECS]} spec
 * @param {WidgetConfig['filters']} filters
 * @param {DateRange} range
 * @param {number} viewerId
 * @param {string|null} groupField - Key from FIELDS, or null for one overall total.
 * @returns {Object[]}
 */
function buildPipeline(spec, filters, range, viewerId, groupField) {
    const userIds = filters.userIds.map((userId) => (userId === ME ? viewerId : userId));
    const taskMatch = { ...(spec.match?.() ?? {}) };
    const dayRange = {};

    if (filters.projectIds.length > 0) {
        taskMatch.projectId = { $in: filters.projectIds };
    }

    if (filters.priorities.length > 0) {
        taskMatch.priority = { $in: filters.priorities };
    }

    if (filters.completion === 'open') {
        taskMatch.completedAt = null;
    } else if (filters.completion === 'done') {
        taskMatch.completedAt = { $ne: null };
    }

    if (range.from) {
        dayRange.$gte = range.from;
    }

    if (range.to) {
        dayRange.$lte = range.to;
    }

    const hasDayRange = Object.keys(dayRange).length > 0;
    const pipeline = [];

    if (spec.source === 'time') {
        const entryMatch = {};

        if (hasDayRange) {
            entryMatch.date = dayRange;
        }

        if (userIds.length > 0) {
            entryMatch.userId = { $in: userIds };
        }

        pipeline.push(
            { $match: entryMatch },
            { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
            { $unwind: '$task' },
            {
                $match: Object.fromEntries(
                    Object.entries(taskMatch).map(([field, condition]) => [`task.${field}`, condition])
                ),
            }
        );
    } else {
        if (userIds.length > 0) {
            taskMatch.assigneeId = { $in: userIds };
        }

        pipeline.push(
            { $match: taskMatch },
            {
                $addFields: {
                    day: DATE_FIELDS.has(spec.date)
                        ? { $dateToString: { format: '%Y-%m-%d', date: `$${spec.date}` } }
                        : `$${spec.date}`,
                },
            },
            { $match: { day: { $ne: null, ...dayRange } } }
        );
    }

    pipeline.push({
        $group: {
            _id: groupField ? FIELDS[spec.source][groupField] : null,
            sum: { $sum: spec.value ?? 1 },
            count: { $sum: 1 },
        },
    });

    return pipeline;
}

/**
 * Turns a group's sum and count into the metric's value.
 *
 * @param {typeof METRIC_SPECS[keyof typeof METRIC_SPECS]} spec
 * @param {{ sum: number, count: number }} group
 * @returns {number|null}
 */
function valueOf(spec, group) {
    if (spec.aggregate === 'count') {
        return group.count;
    }

    if (spec.aggregate === 'avg' && group.count === 0) {
        return null;
    }

    const raw = spec.aggregate === 'avg' ? group.sum / group.count : group.sum;
    const factor = 10 ** spec.decimals;

    return Math.round(raw * factor) / factor;
}

/**
 * @param {typeof METRIC_SPECS[keyof typeof METRIC_SPECS]} spec
 * @param {Object[]} pipeline
 * @returns {Promise<{ _id: any, sum: number, count: number }[]>}
 */
async function runPipeline(spec, pipeline) {
    return (await collection(spec.source === 'time' ? 'timeEntries' : 'tasks')).aggregate(pipeline).toArray();
}

/**
 * Loads display names for the ids that appear as group keys.
 *
 * @param {string} groupBy
 * @param {any[]} keys
 * @returns {Promise<Map<any, string>>}
 */
async function loadLabels(groupBy, keys) {
    const collections = { user: 'users', project: 'projects', status: 'statuses' };

    if (!collections[groupBy]) {
        return new Map();
    }

    const docs = await (await collection(collections[groupBy]))
        .find({ _id: { $in: keys.filter((key) => key !== null) } }, { projection: { name: 1 } })
        .toArray();

    return new Map(docs.map((doc) => [doc._id, doc.name]));
}

/**
 * Maps a raw group key to its display key and label. Statuses merge by
 * name (every board has its own "Done"); weeks and months bucket days.
 *
 * @param {string} groupBy
 * @param {any} rawKey
 * @param {Map<any, string>} labels
 * @returns {{ key: string, label: string }}
 */
function bucketFor(groupBy, rawKey, labels) {
    switch (groupBy) {
        case 'user':
            return rawKey === null
                ? { key: '0', label: 'Unassigned' }
                : { key: String(rawKey), label: labels.get(rawKey) ?? 'Deleted user' };
        case 'project':
            return { key: String(rawKey), label: labels.get(rawKey) ?? 'Deleted board' };
        case 'status': {
            const name = labels.get(rawKey) ?? 'Deleted column';
            return { key: name, label: name };
        }
        case 'week': {
            const key = toISODate(startOfWeek(parseISODate(rawKey)));
            return { key, label: key };
        }
        case 'month':
            return { key: rawKey.slice(0, 7), label: rawKey.slice(0, 7) };
        default:
            return { key: String(rawKey), label: String(rawKey) };
    }
}

/**
 * Walks from `from` to `to` producing every day/week/month key, so time
 * charts show gaps as zero rather than silently skipping them.
 *
 * @param {string} from
 * @param {string} to
 * @param {'day'|'week'|'month'} groupBy
 * @returns {string[]}
 */
function periodKeys(from, to, groupBy) {
    const keys = [];
    const end = parseISODate(to);
    let cursor = parseISODate(from);

    if (groupBy === 'week') {
        cursor = startOfWeek(cursor);
    } else if (groupBy === 'month') {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    }

    while (cursor <= end && keys.length < MAX_TIME_POINTS) {
        if (groupBy === 'month') {
            keys.push(toISODate(cursor).slice(0, 7));
            cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        } else {
            keys.push(toISODate(cursor));
            cursor = addDays(cursor, groupBy === 'week' ? 7 : 1);
        }
    }

    return keys;
}

/**
 * @param {MetricRow[]} rows
 * @param {DateRange} range
 * @param {'day'|'week'|'month'} groupBy
 * @param {number|null} fillWith
 * @returns {MetricRow[]}
 */
function fillPeriods(rows, range, groupBy, fillWith) {
    if (rows.length === 0 && (!range.from || !range.to)) {
        return rows;
    }

    const byKey = new Map(rows.map((row) => [row.key, row]));
    const firstKey = rows[0]?.key;
    const lastKey = rows[rows.length - 1]?.key;
    const from = range.from ?? (groupBy === 'month' ? `${firstKey}-01` : firstKey);
    const to = range.to ?? (groupBy === 'month' ? `${lastKey}-28` : lastKey);

    return periodKeys(from, to, groupBy).map(
        (key) => byKey.get(key) ?? { key, label: key, value: fillWith }
    );
}

/**
 * @param {typeof METRIC_SPECS[keyof typeof METRIC_SPECS]} spec
 * @param {WidgetConfig['filters']} filters
 * @param {DateRange} range
 * @param {number} viewerId
 * @returns {Promise<number|null>}
 */
async function queryTotal(spec, filters, range, viewerId) {
    const [group] = await runPipeline(spec, buildPipeline(spec, filters, range, viewerId, null));

    if (!group) {
        return spec.aggregate === 'avg' ? null : 0;
    }

    return valueOf(spec, group);
}

/**
 * Computes a widget's data.
 *
 * @param {WidgetConfig} config
 * @param {number} viewerId - Resolves the "me" people filter.
 * @returns {Promise<MetricResult>}
 */
export async function computeMetric(config, viewerId) {
    const spec = METRIC_SPECS[config.metric];
    const { current, previous } = resolveDateRange(config.filters);
    const [total, previousTotal] = await Promise.all([
        queryTotal(spec, config.filters, current, viewerId),
        previous ? queryTotal(spec, config.filters, previous, viewerId) : null,
    ]);

    if (config.groupBy === 'none') {
        return { total, previousTotal, rows: [], range: current };
    }

    const isTimeGroup = TIME_GROUP_BYS.includes(config.groupBy);
    const groups = await runPipeline(
        spec,
        buildPipeline(spec, config.filters, current, viewerId, isTimeGroup ? 'day' : config.groupBy)
    );
    const labels = await loadLabels(config.groupBy, groups.map((group) => group._id));
    const buckets = new Map();

    for (const group of groups) {
        const { key, label } = bucketFor(config.groupBy, group._id, labels);
        const bucket = buckets.get(key) ?? { key, label, sum: 0, count: 0 };

        bucket.sum += group.sum;
        bucket.count += group.count;
        buckets.set(key, bucket);
    }

    let rows = [...buckets.values()].map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        value: valueOf(spec, bucket),
    }));

    if (isTimeGroup) {
        rows.sort((a, b) => (a.key < b.key ? -1 : 1));
        rows = fillPeriods(
            rows,
            current,
            /** @type {'day'|'week'|'month'} */ (config.groupBy),
            spec.aggregate === 'avg' ? null : 0
        );
    } else if (config.groupBy === 'priority') {
        rows.sort((a, b) => PRIORITY_ORDER[a.key] - PRIORITY_ORDER[b.key]);
    } else {
        rows = rows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, MAX_CATEGORY_ROWS);
    }

    return { total, previousTotal, rows, range: current };
}

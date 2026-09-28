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

import { getDb } from './db';
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

const TIME_SOURCE = `
    time_entries te
    JOIN tasks t ON t.id = te.task_id
    JOIN projects p ON p.id = t.project_id
    JOIN statuses s ON s.id = t.status_id
    LEFT JOIN users u ON u.id = te.user_id
`;

const TASK_SOURCE = `
    tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN statuses s ON s.id = t.status_id
    LEFT JOIN users u ON u.id = t.assignee_id
`;

/**
 * Every SQL fragment interpolated into a query comes from this table or
 * GROUPS below; user input only ever reaches SQL as bound parameters.
 */
const METRIC_SQL = {
    hours_logged: {
        from: TIME_SOURCE,
        value: 'ROUND(SUM(te.hours), 2)',
        date: 'te.date',
        user: 'te.user_id',
        where: [],
        fillWith: 0,
    },
    tasks_created: {
        from: TASK_SOURCE,
        value: 'COUNT(*)',
        date: 'date(t.created_at)',
        user: 't.assignee_id',
        where: [],
        fillWith: 0,
    },
    tasks_completed: {
        from: TASK_SOURCE,
        value: 'COUNT(*)',
        date: 'date(t.completed_at)',
        user: 't.assignee_id',
        where: ['t.completed_at IS NOT NULL'],
        fillWith: 0,
    },
    tasks_open: {
        from: TASK_SOURCE,
        value: 'COUNT(*)',
        date: 'date(t.created_at)',
        user: 't.assignee_id',
        where: ['t.completed_at IS NULL'],
        fillWith: 0,
    },
    tasks_overdue: {
        from: TASK_SOURCE,
        value: 'COUNT(*)',
        date: 't.due_date',
        user: 't.assignee_id',
        where: ['t.completed_at IS NULL', 't.due_date IS NOT NULL', 't.due_date < :today'],
        fillWith: 0,
    },
    estimated_hours: {
        from: TASK_SOURCE,
        value: 'ROUND(COALESCE(SUM(t.estimate_hours), 0), 2)',
        date: 'date(t.created_at)',
        user: 't.assignee_id',
        where: [],
        fillWith: 0,
    },
    avg_completion_days: {
        from: TASK_SOURCE,
        value: 'ROUND(AVG(julianday(t.completed_at) - julianday(t.created_at)), 1)',
        date: 'date(t.completed_at)',
        user: 't.assignee_id',
        where: ['t.completed_at IS NOT NULL'],
        fillWith: null,
    },
};

/**
 * Group key/label expressions. `{date}` is replaced with the metric's date column.
 */
const GROUPS = {
    user: { key: 'COALESCE(u.id, 0)', label: "COALESCE(u.name, 'Unassigned')" },
    project: { key: 'p.id', label: 'p.name' },
    status: { key: 's.name', label: 's.name' },
    priority: { key: 't.priority', label: 't.priority' },
    day: { key: '{date}', label: '{date}' },
    week: { key: "date({date}, '-6 days', 'weekday 1')", label: "date({date}, '-6 days', 'weekday 1')" },
    month: { key: "strftime('%Y-%m', {date})", label: "strftime('%Y-%m', {date})" },
};

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
 * Builds the WHERE clause and parameters shared by the total and grouped queries.
 *
 * @param {typeof METRIC_SQL[keyof typeof METRIC_SQL]} metric
 * @param {WidgetConfig['filters']} filters
 * @param {DateRange} range
 * @param {number} viewerId
 * @returns {{ where: string, params: Record<string, string|number> }}
 */
function buildWhere(metric, filters, range, viewerId) {
    const conditions = [...metric.where];
    /** @type {Record<string, string|number>} */
    const params = {};

    if (metric.where.some((condition) => condition.includes(':today'))) {
        params.today = toISODate(new Date());
    }

    if (range.from) {
        conditions.push(`${metric.date} >= :from`);
        params.from = range.from;
    }

    if (range.to) {
        conditions.push(`${metric.date} <= :to`);
        params.to = range.to;
    }

    /**
     * @param {string} column
     * @param {string} prefix
     * @param {(string|number)[]} values
     */
    const addIn = (column, prefix, values) => {
        const names = values.map((value, index) => {
            params[`${prefix}${index}`] = value;
            return `:${prefix}${index}`;
        });

        conditions.push(`${column} IN (${names.join(', ')})`);
    };

    if (filters.projectIds.length > 0) {
        addIn('p.id', 'project', filters.projectIds);
    }

    if (filters.userIds.length > 0) {
        addIn(metric.user, 'user', filters.userIds.map((userId) => (userId === ME ? viewerId : userId)));
    }

    if (filters.priorities.length > 0) {
        addIn('t.priority', 'priority', filters.priorities);
    }

    if (filters.completion === 'open') {
        conditions.push('t.completed_at IS NULL');
    } else if (filters.completion === 'done') {
        conditions.push('t.completed_at IS NOT NULL');
    }

    return {
        where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        params,
    };
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
 * @param {typeof METRIC_SQL[keyof typeof METRIC_SQL]} metric
 * @param {WidgetConfig['filters']} filters
 * @param {DateRange} range
 * @param {number} viewerId
 * @returns {number|null}
 */
function queryTotal(metric, filters, range, viewerId) {
    const { where, params } = buildWhere(metric, filters, range, viewerId);
    const row = getDb().prepare(`SELECT ${metric.value} AS value FROM ${metric.from} ${where}`).get(params);

    return row?.value ?? (metric.fillWith === null ? null : 0);
}

/**
 * Computes a widget's data.
 *
 * @param {WidgetConfig} config
 * @param {number} viewerId - Resolves the "me" people filter.
 * @returns {MetricResult}
 */
export function computeMetric(config, viewerId) {
    const metric = METRIC_SQL[config.metric];
    const { current, previous } = resolveDateRange(config.filters);
    const total = queryTotal(metric, config.filters, current, viewerId);
    const previousTotal = previous ? queryTotal(metric, config.filters, previous, viewerId) : null;

    if (config.groupBy === 'none') {
        return { total, previousTotal, rows: [], range: current };
    }

    const group = GROUPS[config.groupBy];
    const keyExpression = group.key.replaceAll('{date}', metric.date);
    const labelExpression = group.label.replaceAll('{date}', metric.date);
    const isTimeGroup = TIME_GROUP_BYS.includes(config.groupBy);
    const { where, params } = buildWhere(metric, config.filters, current, viewerId);
    const whereWithKey = isTimeGroup
        ? `${where ? `${where} AND` : 'WHERE'} ${metric.date} IS NOT NULL`
        : where;

    let rows = getDb()
        .prepare(
            `SELECT ${keyExpression} AS key, ${labelExpression} AS label, ${metric.value} AS value
             FROM ${metric.from}
             ${whereWithKey}
             GROUP BY key
             ORDER BY ${isTimeGroup ? 'key ASC' : 'value DESC'}`
        )
        .all(params)
        .map((row) => ({ key: String(row.key), label: String(row.label), value: row.value }));

    if (isTimeGroup) {
        rows = fillPeriods(rows, current, /** @type {'day'|'week'|'month'} */ (config.groupBy), metric.fillWith);
    } else if (config.groupBy === 'priority') {
        rows.sort((a, b) => PRIORITY_ORDER[a.key] - PRIORITY_ORDER[b.key]);
    } else {
        rows = rows.slice(0, MAX_CATEGORY_ROWS);
    }

    return { total, previousTotal, rows, range: current };
}

/**
 * Shared option lists. This module must stay free of server imports
 * because it is used by both pages and API routes.
 */

/** @typedef {'urgent'|'high'|'normal'|'low'} Priority */

/** @type {{ value: Priority, label: string, color: string }[]} */
export const PRIORITIES = [
    { value: 'urgent', label: 'Urgent', color: '#d03b3b' },
    { value: 'high', label: 'High', color: '#ec835a' },
    { value: 'normal', label: 'Normal', color: '#2a78d6' },
    { value: 'low', label: 'Low', color: '#898781' },
];

export const PRIORITY_VALUES = PRIORITIES.map((priority) => priority.value);

/** Swatches offered for boards, columns and users. */
export const COLORS = [
    '#2a78d6',
    '#eb6834',
    '#1baf7a',
    '#eda100',
    '#e87ba4',
    '#008300',
    '#4a3aa7',
    '#e34948',
    '#898781',
];

export const DEFAULT_STATUSES = [
    { name: 'To do', color: '#898781', isDone: false },
    { name: 'In progress', color: '#2a78d6', isDone: false },
    { name: 'Review', color: '#eda100', isDone: false },
    { name: 'Done', color: '#1baf7a', isDone: true },
];

/**
 * @typedef {Object} MetricOption
 * @property {string} value
 * @property {string} label
 * @property {string} description
 * @property {'hours'|'count'|'days'} unit
 */

/** @type {MetricOption[]} */
export const METRICS = [
    {
        value: 'hours_logged',
        label: 'Hours logged',
        description: 'Total time entries. Dates filter on the day the work was done.',
        unit: 'hours',
    },
    {
        value: 'tasks_created',
        label: 'Tasks created',
        description: 'Tasks by creation date. People filter on the assignee.',
        unit: 'count',
    },
    {
        value: 'tasks_completed',
        label: 'Tasks completed',
        description: 'Tasks moved into a "done" column, by completion date.',
        unit: 'count',
    },
    {
        value: 'tasks_open',
        label: 'Open tasks',
        description: 'Tasks not yet done, by creation date.',
        unit: 'count',
    },
    {
        value: 'tasks_overdue',
        label: 'Overdue tasks',
        description: 'Open tasks whose due date has passed, by due date.',
        unit: 'count',
    },
    {
        value: 'estimated_hours',
        label: 'Estimated hours',
        description: 'Sum of task estimates, by creation date.',
        unit: 'hours',
    },
    {
        value: 'avg_completion_days',
        label: 'Avg. days to complete',
        description: 'Average time from creation to completion, by completion date.',
        unit: 'days',
    },
];

export const METRIC_VALUES = METRICS.map((metric) => metric.value);

export const GROUP_BYS = [
    { value: 'none', label: 'Nothing (single total)' },
    { value: 'user', label: 'Person' },
    { value: 'project', label: 'Board' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
];

export const GROUP_BY_VALUES = GROUP_BYS.map((group) => group.value);
export const TIME_GROUP_BYS = ['day', 'week', 'month'];

export const CHART_TYPES = [
    { value: 'number', label: 'Number' },
    { value: 'bar', label: 'Bar chart' },
    { value: 'line', label: 'Line chart' },
    { value: 'table', label: 'Table' },
];

export const CHART_TYPE_VALUES = CHART_TYPES.map((chart) => chart.value);

export const DATE_RANGES = [
    { value: 'all', label: 'All time' },
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This week' },
    { value: 'last_week', label: 'Last week' },
    { value: 'last_7_days', label: 'Last 7 days' },
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'last_30_days', label: 'Last 30 days' },
    { value: 'last_90_days', label: 'Last 90 days' },
    { value: 'this_year', label: 'This year' },
    { value: 'custom', label: 'Custom range' },
];

export const DATE_RANGE_VALUES = DATE_RANGES.map((range) => range.value);

export const COMPLETION_FILTERS = [
    { value: 'any', label: 'Any' },
    { value: 'open', label: 'Open only' },
    { value: 'done', label: 'Done only' },
];

export const COMPLETION_VALUES = COMPLETION_FILTERS.map((option) => option.value);

export const WIDGET_WIDTHS = [
    { value: 'third', label: 'Small (1/3)' },
    { value: 'half', label: 'Medium (1/2)' },
    { value: 'two_thirds', label: 'Large (2/3)' },
    { value: 'full', label: 'Full width' },
];

export const WIDGET_WIDTH_VALUES = WIDGET_WIDTHS.map((width) => width.value);

/** Stands in for the viewer's own id in a widget's people filter. */
export const ME = 'me';

/**
 * @typedef {Object} WidgetFilters
 * @property {string} dateRange
 * @property {string} [from]
 * @property {string} [to]
 * @property {number[]} projectIds
 * @property {(number|'me')[]} userIds
 * @property {Priority[]} priorities
 * @property {'any'|'open'|'done'} completion
 */

/**
 * @typedef {Object} WidgetConfig
 * @property {string} metric
 * @property {string} groupBy
 * @property {string} chart
 * @property {WidgetFilters} filters
 */

/** @type {WidgetConfig} */
export const DEFAULT_WIDGET_CONFIG = {
    metric: 'hours_logged',
    groupBy: 'none',
    chart: 'number',
    filters: {
        dateRange: 'this_week',
        projectIds: [],
        userIds: [],
        priorities: [],
        completion: 'any',
    },
};

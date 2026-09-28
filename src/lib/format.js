import { parseISODate } from './dates';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });

/**
 * Formats a metric value for display.
 *
 * @param {number|null} value
 * @param {'hours'|'count'|'days'} unit
 * @param {Object} [options]
 * @param {boolean} [options.compact=false]
 * @returns {string}
 */
export function formatMetric(value, unit, { compact = false } = {}) {
    if (value === null || value === undefined) {
        return '—';
    }

    const formatted = compact && Math.abs(value) >= 10000
        ? compactFormat.format(value)
        : numberFormat.format(value);

    if (unit === 'hours') {
        return `${formatted}h`;
    }

    if (unit === 'days') {
        return `${formatted}d`;
    }

    return formatted;
}

/**
 * Formats a 24-hour `HH:MM` time as "9:30 AM".
 *
 * @param {string} value
 * @returns {string}
 */
export function formatTime(value) {
    const [hours, minutes] = value.split(':').map(Number);

    return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Formats hours as whole hours and minutes, like "1h 15m".
 *
 * @param {number} hours
 * @returns {string}
 */
export function formatHoursMinutes(hours) {
    const totalMinutes = Math.round(hours * 60);
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (wholeHours === 0) {
        return `${minutes}m`;
    }

    return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
}

/**
 * Formats hours like `3.5h`.
 *
 * @param {number|null} hours
 * @returns {string}
 */
export function formatHours(hours) {
    return formatMetric(hours ?? 0, 'hours');
}

/**
 * Formats a `YYYY-MM-DD` date as "Sep 28", or "Sep 28, 2025" outside the current year.
 *
 * @param {string|null} value
 * @returns {string}
 */
export function formatDate(value) {
    if (!value) {
        return '';
    }

    const date = parseISODate(value.slice(0, 10));

    return date.getFullYear() === new Date().getFullYear()
        ? shortDate.format(date)
        : longDate.format(date);
}

/**
 * Formats an ISO timestamp in local time.
 *
 * @param {string} value
 * @returns {string}
 */
export function formatTimestamp(value) {
    const date = new Date(value);

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/**
 * Turns a metric group key (a date, week start or month) into a readable label.
 *
 * @param {string} key
 * @param {string} groupBy
 * @returns {string}
 */
export function formatPeriod(key, groupBy) {
    if (groupBy === 'month') {
        return monthFormat.format(parseISODate(`${key}-01`));
    }

    if (groupBy === 'week') {
        return `Wk of ${formatDate(key)}`;
    }

    return formatDate(key);
}

/**
 * Up to two initials for an avatar.
 *
 * @param {string} name
 * @returns {string}
 */
export function initials(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
}

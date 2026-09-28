/**
 * Formats a Date as `YYYY-MM-DD` in local time.
 *
 * @param {Date} date
 * @returns {string}
 */
export function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Parses `YYYY-MM-DD` as a local-time Date (not UTC, which would shift
 * the day for anyone west of Greenwich).
 *
 * @param {string} value
 * @returns {Date}
 */
export function parseISODate(value) {
    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day);
}

/**
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);

    return result;
}

/**
 * Monday of the week containing `date`.
 *
 * @param {Date} date
 * @returns {Date}
 */
export function startOfWeek(date) {
    const offset = (date.getDay() + 6) % 7;

    return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -offset);
}

/**
 * Returns today's date as `YYYY-MM-DD`.
 *
 * @returns {string}
 */
export function today() {
    return toISODate(new Date());
}

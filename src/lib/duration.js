/**
 * Parses a typed duration into hours. Accepts `1.5`, `1h`, `1h 30m`,
 * `90m`, `45min` and `1:30`.
 *
 * @param {string} input
 * @returns {number|null} Hours, or null if the input isn't a duration.
 */
export function parseDuration(input) {
    const value = input.trim().toLowerCase();

    if (value === '') {
        return null;
    }

    if (/^\d+(\.\d+)?$/.test(value)) {
        return Number(value);
    }

    const clock = value.match(/^(\d+):([0-5]\d)$/);

    if (clock) {
        return Number(clock[1]) + Number(clock[2]) / 60;
    }

    const units = value.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/);

    if (units && (units[1] || units[2])) {
        return Number(units[1] ?? 0) + Number(units[2] ?? 0) / 60;
    }

    return null;
}

/**
 * Minutes since midnight for a 24-hour `HH:MM` time.
 *
 * @param {string} value
 * @returns {number}
 */
export function toMinutes(value) {
    const [hours, minutes] = value.split(':').map(Number);

    return hours * 60 + minutes;
}

/**
 * Hours between two `HH:MM` times on the same day, or null if the end
 * isn't after the start.
 *
 * @param {string} start
 * @param {string} end
 * @returns {number|null}
 */
export function rangeHours(start, end) {
    const minutes = toMinutes(end) - toMinutes(start);

    return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : null;
}

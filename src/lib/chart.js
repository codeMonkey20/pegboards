/**
 * Rounds a maximum up to a clean axis value and returns evenly spaced ticks.
 *
 * @param {number} max
 * @param {number} [tickCount=4]
 * @returns {{ max: number, ticks: number[] }}
 */
export function niceScale(max, tickCount = 4) {
    if (!Number.isFinite(max) || max <= 0) {
        return { max: 1, ticks: [0, 1] };
    }

    const rawStep = max / tickCount;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;
    const niceNormalized = [1, 2, 2.5, 5, 10].find((step) => normalized <= step);
    const step = niceNormalized * magnitude;
    const niceMax = Math.ceil(max / step) * step;
    const ticks = [];

    for (let value = 0; value <= niceMax + step / 2; value += step) {
        ticks.push(Math.round(value * 1000) / 1000);
    }

    return { max: niceMax, ticks };
}

import { formatMetric } from '@/lib/format';

/**
 * Whether a rise in each metric is good, bad or neither. Neutral deltas
 * are shown without colour.
 */
const UP_IS = {
    hours_logged: 'neutral',
    tasks_created: 'neutral',
    tasks_completed: 'good',
    tasks_open: 'neutral',
    tasks_overdue: 'bad',
    estimated_hours: 'neutral',
    avg_completion_days: 'bad',
};

/**
 * Headline number with an optional change vs the previous period.
 *
 * @param {Object} props
 * @param {string} props.metric
 * @param {'hours'|'count'|'days'} props.unit
 * @param {number|null} props.value
 * @param {number|null} props.previous
 * @returns {JSX.Element}
 */
export default function StatValue({ metric, unit, value, previous }) {
    const hasDelta = previous !== null && value !== null;
    const delta = hasDelta ? Math.round((value - previous) * 100) / 100 : 0;
    let sentiment = 'neutral';

    if (delta !== 0 && UP_IS[metric] !== 'neutral') {
        const isRise = delta > 0;
        sentiment = isRise === (UP_IS[metric] === 'good') ? 'good' : 'bad';
    }

    const deltaColor = {
        good: 'text-green-800 dark:text-green-400',
        bad: 'text-red-700 dark:text-red-400',
        neutral: 'text-zinc-600 dark:text-zinc-400',
    }[sentiment];

    return (
        <div className="flex h-full flex-col justify-center py-2">
            <p className="text-4xl font-semibold tracking-tight">{formatMetric(value, unit, { compact: true })}</p>
            {hasDelta && (
                <p className={`mt-1 text-sm ${deltaColor}`}>
                    <span aria-hidden="true">{delta > 0 ? '▲ ' : delta < 0 ? '▼ ' : ''}</span>
                    {delta === 0 ? 'No change' : `${delta > 0 ? '+' : '−'}${formatMetric(Math.abs(delta), unit)}`}
                    <span className="text-zinc-500 dark:text-zinc-400"> vs previous period ({formatMetric(previous, unit)})</span>
                </p>
            )}
        </div>
    );
}

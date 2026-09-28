import { formatMetric } from '@/lib/format';

/**
 * Horizontal bars for categories (people, boards, statuses…), sorted by
 * the server. Labels sit on the left and values at the bar tips.
 *
 * @param {Object} props
 * @param {{ key: string, label: string, value: number|null }[]} props.rows
 * @param {'hours'|'count'|'days'} props.unit
 * @returns {JSX.Element}
 */
export default function BarList({ rows, unit }) {
    const max = Math.max(...rows.map((row) => row.value ?? 0), 0) || 1;

    return (
        <ul className="space-y-2">
            {rows.map((row) => (
                <li
                    key={row.key}
                    title={`${row.label}: ${formatMetric(row.value, unit)}`}
                    className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 text-sm"
                >
                    <span className="truncate text-zinc-700 dark:text-zinc-300">{row.label}</span>
                    <span className="flex items-center gap-2">
                        <span
                            className="h-4 max-w-[calc(100%-3.5rem)] min-w-0.5 rounded-r bg-[#2a78d6] dark:bg-[#3987e5]"
                            style={{ width: `${((row.value ?? 0) / max) * 100}%` }}
                        />
                        <span className="shrink-0 text-xs text-zinc-600 tabular-nums dark:text-zinc-400">
                            {formatMetric(row.value, unit, { compact: true })}
                        </span>
                    </span>
                </li>
            ))}
        </ul>
    );
}

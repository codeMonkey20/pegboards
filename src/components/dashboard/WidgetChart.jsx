import { METRICS, PRIORITIES, TIME_GROUP_BYS } from '@/lib/constants';
import { formatMetric, formatPeriod } from '@/lib/format';

import BarList from './BarList';
import StatValue from './StatValue';
import TimeChart from './TimeChart';

/**
 * Renders a widget's data in its chosen chart form.
 *
 * @param {Object} props
 * @param {import('@/lib/constants').WidgetConfig} props.config
 * @param {import('@/server/metrics').MetricResult} props.data
 * @returns {JSX.Element}
 */
export default function WidgetChart({ config, data }) {
    const unit = METRICS.find((metric) => metric.value === config.metric)?.unit ?? 'count';
    const isTimeGroup = TIME_GROUP_BYS.includes(config.groupBy);

    if (config.chart === 'number' || config.groupBy === 'none') {
        return <StatValue metric={config.metric} unit={unit} value={data.total} previous={data.previousTotal} />;
    }

    const rows = data.rows.map((row) => ({
        ...row,
        label: isTimeGroup
            ? formatPeriod(row.key, config.groupBy)
            : config.groupBy === 'priority'
                ? PRIORITIES.find((priority) => priority.value === row.key)?.label ?? row.label
                : row.label,
    }));

    const hasData = rows.some((row) => row.value);

    if (!hasData) {
        return <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No data for these filters yet.</p>;
    }

    if (config.chart === 'table') {
        return (
            <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-zinc-900">
                        <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                            <th scope="col" className="py-1 font-medium">{isTimeGroup ? 'Period' : 'Group'}</th>
                            <th scope="col" className="py-1 text-right font-medium">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {rows.map((row) => (
                            <tr key={row.key}>
                                <td className="py-1.5">{row.label}</td>
                                <td className="py-1.5 text-right tabular-nums">{formatMetric(row.value, unit)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-zinc-300 font-semibold dark:border-zinc-700">
                            <th scope="row" className="py-1.5 text-left">{config.metric === 'avg_completion_days' ? 'Overall' : 'Total'}</th>
                            <td className="py-1.5 text-right tabular-nums">{formatMetric(data.total, unit)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        );
    }

    if (isTimeGroup) {
        return <TimeChart rows={rows} unit={unit} variant={config.chart === 'line' ? 'line' : 'bar'} />;
    }

    return <BarList rows={rows} unit={unit} />;
}

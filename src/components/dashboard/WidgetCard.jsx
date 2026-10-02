import { DATE_RANGES, ME, METRICS } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import { formatDate } from '@/lib/format';

import WidgetChart from './WidgetChart';

const WIDTH_CLASSES = {
    third: 'md:col-span-2',
    half: 'md:col-span-3',
    two_thirds: 'md:col-span-4',
    full: 'md:col-span-6',
};

/**
 * One-line summary of a widget's filters, e.g. "This week · Me · 2 boards".
 *
 * @param {import('@/lib/constants').WidgetConfig} config
 * @param {Map<number, string>} projectNames
 * @param {Map<number, string>} userNames
 * @returns {string}
 */
function describeFilters(config, projectNames, userNames) {
    const { filters } = config;
    const parts = [];

    if (filters.dateRange === 'custom') {
        parts.push(`${filters.from ? formatDate(filters.from) : 'Start'} – ${filters.to ? formatDate(filters.to) : 'today'}`);
    } else {
        parts.push(DATE_RANGES.find((range) => range.value === filters.dateRange)?.label ?? '');
    }

    /**
     * @param {(string|number)[]} ids
     * @param {(id: string|number) => string|undefined} nameFor
     * @param {string} noun
     */
    const describeList = (ids, nameFor, noun) => {
        if (ids.length === 1) {
            parts.push(nameFor(ids[0]) ?? `1 ${noun}`);
        } else if (ids.length > 1) {
            parts.push(`${ids.length} ${noun}s`);
        }
    };

    describeList(filters.userIds, (id) => (id === ME ? 'Me' : userNames.get(id)), 'person');
    describeList(filters.projectIds, (id) => projectNames.get(id), 'board');
    describeList(filters.priorities, (value) => `${value[0].toUpperCase()}${value.slice(1)} priority`, 'priority');

    if (filters.completion !== 'any') {
        parts.push(filters.completion === 'open' ? 'Open tasks' : 'Done tasks');
    }

    return parts.join(' · ');
}

/**
 * A dashboard tile: title, filter summary, chart and edit controls.
 *
 * @param {Object} props
 * @param {import('@/server/dashboards').Widget} props.widget
 * @param {boolean} props.canEdit
 * @param {boolean} props.isFirst
 * @param {boolean} props.isLast
 * @param {Map<number, string>} props.projectNames
 * @param {Map<number, string>} props.userNames
 * @param {'moving'|'removing'|null} [props.busy] - A request for this widget is running.
 * @param {boolean} [props.moveDisabled] - Another reorder is still saving.
 * @param {() => void} props.onEdit
 * @param {(direction: -1|1) => void} props.onMove
 * @param {() => void} props.onDelete
 * @returns {JSX.Element}
 */
export default function WidgetCard({ widget, canEdit, isFirst, isLast, projectNames, userNames, busy = null, moveDisabled = false, onEdit, onMove, onDelete }) {
    const metricLabel = METRICS.find((metric) => metric.value === widget.config.metric)?.label;
    const controlClass = 'rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
    const isBusy = busy !== null;

    return (
        <article
            aria-labelledby={`widget-${widget.id}`}
            aria-busy={isBusy || undefined}
            className={`col-span-1 flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-opacity dark:border-zinc-800 dark:bg-zinc-900 ${WIDTH_CLASSES[widget.width] ?? WIDTH_CLASSES.third} ${busy === 'removing' ? 'opacity-50' : ''}`}
        >
            <header className="mb-3 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <h2 id={`widget-${widget.id}`} className="text-sm font-semibold">{widget.title}</h2>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {metricLabel} · {describeFilters(widget.config, projectNames, userNames)}
                    </p>
                </div>
                {isBusy && (
                    <span role="status" className="flex shrink-0 items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <Spinner className="h-3.5 w-3.5" />
                        {busy === 'removing' ? 'Removing…' : 'Saving…'}
                    </span>
                )}
                {canEdit && (
                    <div className="flex shrink-0 gap-0.5">
                        <button type="button" onClick={() => onMove(-1)} disabled={isFirst || isBusy || moveDisabled} className={controlClass}>
                            <span aria-hidden="true">←</span>
                            <span className="sr-only">Move {widget.title} earlier</span>
                        </button>
                        <button type="button" onClick={() => onMove(1)} disabled={isLast || isBusy || moveDisabled} className={controlClass}>
                            <span aria-hidden="true">→</span>
                            <span className="sr-only">Move {widget.title} later</span>
                        </button>
                        <button type="button" onClick={onEdit} disabled={isBusy} className={controlClass}>
                            Edit<span className="sr-only"> {widget.title}</span>
                        </button>
                        <button type="button" onClick={onDelete} disabled={isBusy} className={`${controlClass} hover:text-red-700 dark:hover:text-red-300`}>
                            Remove<span className="sr-only"> {widget.title}</span>
                        </button>
                    </div>
                )}
            </header>
            <div className="flex-1">
                <WidgetChart config={widget.config} data={widget.data} />
            </div>
        </article>
    );
}

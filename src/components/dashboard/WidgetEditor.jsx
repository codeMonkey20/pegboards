import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import { ErrorMessage, Field, Input, Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import Spinner from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import {
    CHART_TYPES,
    COMPLETION_FILTERS,
    DATE_RANGES,
    DEFAULT_WIDGET_CONFIG,
    GROUP_BYS,
    ME,
    METRICS,
    PRIORITIES,
    TIME_GROUP_BYS,
    WIDGET_WIDTHS,
} from '@/lib/constants';
import { useBusy } from '@/lib/useBusy';

import WidgetChart from './WidgetChart';

/**
 * Makes the grouping agree with the chart type: numbers aren't grouped,
 * lines need a time axis, and bars/tables need some grouping.
 *
 * @param {import('@/lib/constants').WidgetConfig} config
 * @returns {import('@/lib/constants').WidgetConfig}
 */
function reconcile(config) {
    if (config.chart === 'number') {
        return { ...config, groupBy: 'none' };
    }

    if (config.chart === 'line' && !TIME_GROUP_BYS.includes(config.groupBy)) {
        return { ...config, groupBy: 'day' };
    }

    if (config.groupBy === 'none') {
        return { ...config, groupBy: 'user' };
    }

    return config;
}

/**
 * Checkbox list for a multi-select filter. Nothing checked means "all".
 *
 * @param {Object} props
 * @param {string} props.legend
 * @param {{ value: string|number, label: string }[]} props.options
 * @param {(string|number)[]} props.selected
 * @param {(values: (string|number)[]) => void} props.onChange
 * @returns {JSX.Element}
 */
function CheckboxFilter({ legend, options, selected, onChange }) {
    return (
        <fieldset className="min-w-0">
            <legend className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {legend} <span className="font-normal text-zinc-500">{selected.length === 0 ? '(all)' : `(${selected.length})`}</span>
            </legend>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                {options.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={selected.includes(option.value)}
                            onChange={(event) =>
                                onChange(
                                    event.target.checked
                                        ? [...selected, option.value]
                                        : selected.filter((value) => value !== option.value)
                                )
                            }
                            className="h-4 w-4 accent-violet-600"
                        />
                        <span className="truncate">{option.label}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

/**
 * Create or edit a dashboard widget, with a live preview.
 *
 * @param {Object} props
 * @param {import('@/server/dashboards').Widget|null} props.widget - Null when adding.
 * @param {{ id: number, name: string }[]} props.projects
 * @param {{ id: number, name: string }[]} props.users
 * @param {() => void} props.onClose
 * @param {(values: { title: string, width: string, config: import('@/lib/constants').WidgetConfig }) => Promise<void>} props.onSave
 * @returns {JSX.Element}
 */
export default function WidgetEditor({ widget, projects, users, onClose, onSave }) {
    const [title, setTitle] = useState(widget?.title ?? '');
    const [width, setWidth] = useState(widget?.width ?? 'third');
    const [config, setConfig] = useState(widget?.config ?? DEFAULT_WIDGET_CONFIG);
    // Both remember which config they belong to, so the preview can tell
    // when it is out of date without extra loading state.
    const [preview, setPreview] = useState(widget ? { config: widget.config, data: widget.data } : null);
    const [previewError, setPreviewError] = useState(null);
    const [error, setError] = useState(null);
    const { run, isBusy } = useBusy();
    const saving = isBusy('save');

    const metric = METRICS.find((option) => option.value === config.metric);
    const isCustomRange = config.filters.dateRange === 'custom';
    const isPreviewLoading = preview?.config !== config && previewError?.config !== config;

    // Debounced so typing custom dates doesn't send a request per keystroke.
    useEffect(() => {
        let ignore = false;
        const timer = setTimeout(() => {
            api('/api/widgets/preview', { method: 'POST', body: { config } })
                .then((data) => {
                    if (!ignore) {
                        setPreview({ config, data });
                        setPreviewError(null);
                    }
                })
                .catch((requestError) => {
                    if (!ignore) {
                        setPreviewError({ config, message: requestError.message });
                    }
                });
        }, 250);

        return () => {
            ignore = true;
            clearTimeout(timer);
        };
    }, [config]);

    /** @param {Partial<import('@/lib/constants').WidgetConfig>} changes */
    function update(changes) {
        setConfig((current) => reconcile({ ...current, ...changes }));
    }

    /** @param {Partial<import('@/lib/constants').WidgetFilters>} changes */
    function updateFilters(changes) {
        setConfig((current) => ({ ...current, filters: { ...current.filters, ...changes } }));
    }

    function handleSubmit(event) {
        event.preventDefault();

        run('save', async () => {
            setError(null);

            try {
                await onSave({ title: title.trim() || metric.label, width, config });
            } catch (requestError) {
                setError(requestError.message);
            }
        });
    }

    const groupOptions = GROUP_BYS.filter((group) => {
        if (config.chart === 'number') {
            return group.value === 'none';
        }

        if (config.chart === 'line') {
            return TIME_GROUP_BYS.includes(group.value);
        }

        return group.value !== 'none';
    });

    return (
        <Modal open onClose={onClose} title={widget ? 'Edit widget' : 'Add widget'} size="xl">
            <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-[1fr_20rem]">
                <div className="space-y-4">
                    <Field label="Title" htmlFor="widget-title" hint={`Leave blank to use “${metric.label}”.`}>
                        <Input id="widget-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} />
                    </Field>

                    <Field label="Metric" htmlFor="widget-metric" hint={metric.description}>
                        <Select id="widget-metric" value={config.metric} onChange={(event) => update({ metric: event.target.value })}>
                            {METRICS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Select>
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Show as" htmlFor="widget-chart">
                            <Select id="widget-chart" value={config.chart} onChange={(event) => update({ chart: event.target.value })}>
                                {CHART_TYPES.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Group by" htmlFor="widget-group">
                            <Select
                                id="widget-group"
                                value={config.groupBy}
                                onChange={(event) => update({ groupBy: event.target.value })}
                                disabled={config.chart === 'number'}
                            >
                                {groupOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Date range" htmlFor="widget-range" className={isCustomRange ? 'col-span-2' : ''}>
                            <Select id="widget-range" value={config.filters.dateRange} onChange={(event) => updateFilters({ dateRange: event.target.value })}>
                                {DATE_RANGES.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Select>
                        </Field>
                        {isCustomRange && (
                            <>
                                <Field label="From" htmlFor="widget-from">
                                    <Input id="widget-from" type="date" value={config.filters.from ?? ''} onChange={(event) => updateFilters({ from: event.target.value || undefined })} />
                                </Field>
                                <Field label="To" htmlFor="widget-to">
                                    <Input id="widget-to" type="date" value={config.filters.to ?? ''} onChange={(event) => updateFilters({ to: event.target.value || undefined })} />
                                </Field>
                            </>
                        )}
                        <Field label="Tasks" htmlFor="widget-completion">
                            <Select id="widget-completion" value={config.filters.completion} onChange={(event) => updateFilters({ completion: event.target.value })}>
                                {COMPLETION_FILTERS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Select>
                        </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <CheckboxFilter
                            legend={config.metric === 'hours_logged' ? 'Logged by' : 'Assignee'}
                            options={[{ value: ME, label: 'Me (the viewer)' }, ...users.map((user) => ({ value: user.id, label: user.name }))]}
                            selected={config.filters.userIds}
                            onChange={(userIds) => updateFilters({ userIds })}
                        />
                        <CheckboxFilter
                            legend="Boards"
                            options={projects.map((project) => ({ value: project.id, label: project.name }))}
                            selected={config.filters.projectIds}
                            onChange={(projectIds) => updateFilters({ projectIds })}
                        />
                        <CheckboxFilter
                            legend="Priority"
                            options={PRIORITIES}
                            selected={config.filters.priorities}
                            onChange={(priorities) => updateFilters({ priorities })}
                        />
                    </div>

                    <Field label="Size" htmlFor="widget-width">
                        <Select id="widget-width" value={width} onChange={(event) => setWidth(event.target.value)}>
                            {WIDGET_WIDTHS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Select>
                    </Field>
                </div>

                <div className="flex flex-col gap-4">
                    <section
                        aria-labelledby="preview-heading"
                        aria-busy={isPreviewLoading || undefined}
                        className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <h3 id="preview-heading" className="text-sm font-semibold">{title.trim() || metric.label}</h3>
                            {isPreviewLoading && preview && (
                                <span role="status" className="flex shrink-0 items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    <Spinner className="h-3.5 w-3.5" />
                                    Updating…
                                </span>
                            )}
                        </div>
                        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">Preview</p>
                        <ErrorMessage message={previewError?.message ?? null} />
                        {preview ? (
                            <div className={`transition-opacity ${isPreviewLoading ? 'opacity-50' : ''}`}>
                                <WidgetChart config={preview.config} data={preview.data} />
                            </div>
                        ) : (
                            !previewError && (
                                <div role="status" aria-label="Loading preview" className="space-y-3 py-2">
                                    <Skeleton className="h-10 w-28" />
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            )
                        )}
                    </section>

                    <ErrorMessage message={error} />

                    <div className="mt-auto flex justify-end gap-2">
                        <Button onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" variant="primary" loading={saving}>
                            {saving ? 'Saving…' : widget ? 'Save widget' : 'Add widget'}
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

import { useState } from 'react';

import Button from '@/components/ui/Button';
import { ErrorMessage, Field, Input } from '@/components/ui/Field';
import Spinner from '@/components/ui/Spinner';
import { today } from '@/lib/dates';
import { parseDuration, rangeHours } from '@/lib/duration';
import { formatDate, formatHours, formatHoursMinutes, formatTime } from '@/lib/format';
import { useBusy } from '@/lib/useBusy';

const MODES = [
    { value: 'duration', label: 'Duration' },
    { value: 'range', label: 'Time range' },
];

/**
 * @typedef {Object} NewTimeEntry
 * @property {string} date
 * @property {string} note
 * @property {number} [hours] - Sent for duration entries.
 * @property {string} [startTime] - `HH:MM`, sent for range entries.
 * @property {string} [endTime]
 */

/**
 * Manual time entry for a task: log a duration ("1h 30m") or a clock
 * range ("9:00–10:30"), plus the list of entries. Overlapping ranges are
 * rejected by the server, and its message is shown here.
 *
 * @param {Object} props
 * @param {import('@/server/tasks').TaskDetail} props.task
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {(entry: NewTimeEntry) => Promise<void>} props.onAdd
 * @param {(entryId: number) => Promise<void>} props.onDelete
 * @returns {JSX.Element}
 */
export default function TimeLog({ task, currentUser, onAdd, onDelete }) {
    const [mode, setMode] = useState('duration');
    const [duration, setDuration] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [date, setDate] = useState(today);
    const [note, setNote] = useState('');
    const [error, setError] = useState(null);
    const { run, isBusy } = useBusy();
    const saving = isBusy('add');

    const parsedHours = parseDuration(duration);
    const rangeTotal = startTime && endTime ? rangeHours(startTime, endTime) : null;
    const progress = task.estimateHours ? Math.min(task.hoursLogged / task.estimateHours, 1) : null;
    const isOverEstimate = task.estimateHours && task.hoursLogged > task.estimateHours;

    /**
     * Checks the form and returns the entry to send, or an error message.
     *
     * @returns {{ entry?: NewTimeEntry, problem?: string }}
     */
    function buildEntry() {
        if (mode === 'range') {
            if (rangeTotal === null) {
                return { problem: 'End time must be after start time' };
            }

            return { entry: { startTime, endTime, date, note } };
        }

        if (parsedHours === null || parsedHours <= 0) {
            return { problem: 'Enter time like 1.5, 1h 30m, 90m or 1:30' };
        }

        if (parsedHours > 24) {
            return { problem: 'A single entry can be at most 24 hours' };
        }

        return { entry: { hours: Math.round(parsedHours * 100) / 100, date, note } };
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);

        const { entry, problem } = buildEntry();

        if (problem) {
            setError(problem);
            return;
        }

        run('add', async () => {
            try {
                await onAdd(entry);
                setDuration('');
                setStartTime('');
                setEndTime('');
                setNote('');
            } catch (requestError) {
                setError(requestError.message);
            }
        });
    }

    let rangeHint = 'Same day';

    if (startTime && endTime) {
        rangeHint = rangeTotal === null ? 'End must be after start' : `= ${formatHoursMinutes(rangeTotal)}`;
    }

    return (
        <section aria-labelledby="time-heading">
            <div className="flex items-baseline justify-between gap-2">
                <h3 id="time-heading" className="text-sm font-semibold">Time rendered</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatHours(task.hoursLogged)}</span>
                    {task.estimateHours ? ` of ${formatHours(task.estimateHours)} estimated` : ' logged'}
                </p>
            </div>

            {progress !== null && (
                <div className="mt-2">
                    <div
                        role="progressbar"
                        aria-label="Time logged against estimate"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress * 100)}
                        className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950"
                    >
                        <div
                            className={`h-full rounded-full ${isOverEstimate ? 'bg-red-600' : 'bg-blue-600'}`}
                            style={{ width: `${progress * 100}%` }}
                        />
                    </div>
                    {isOverEstimate && (
                        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                            <span aria-hidden="true">⚠ </span>Over estimate by {formatHours(task.hoursLogged - task.estimateHours)}
                        </p>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <fieldset>
                    <legend className="sr-only">Log time as</legend>
                    <div className="inline-flex rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
                        {MODES.map((option) => (
                            <label key={option.value} className="cursor-pointer">
                                <input
                                    type="radio"
                                    name="time-mode"
                                    value={option.value}
                                    checked={mode === option.value}
                                    onChange={() => {
                                        setMode(option.value);
                                        setError(null);
                                    }}
                                    className="peer sr-only"
                                />
                                <span className="block rounded px-3 py-1 text-xs font-medium text-zinc-600 peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-violet-600 dark:text-zinc-400 dark:peer-checked:bg-zinc-900 dark:peer-checked:text-zinc-100">
                                    {option.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div
                    className={`grid grid-cols-2 gap-3 sm:items-start ${
                        mode === 'range' ? 'sm:grid-cols-[8.5rem_8.5rem_10rem_1fr_auto]' : 'sm:grid-cols-[8rem_10rem_1fr_auto]'
                    }`}
                >
                    {mode === 'range' ? (
                        <>
                            <Field label="Start" htmlFor="time-start" hint={rangeHint}>
                                <Input id="time-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
                            </Field>
                            <Field label="End" htmlFor="time-end">
                                <Input id="time-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
                            </Field>
                        </>
                    ) : (
                        <Field
                            label="Time"
                            htmlFor="time-duration"
                            hint={parsedHours ? `= ${formatHoursMinutes(parsedHours)}` : 'e.g. 1h 30m'}
                        >
                            <Input
                                id="time-duration"
                                value={duration}
                                onChange={(event) => setDuration(event.target.value)}
                                placeholder="1h 30m"
                                inputMode="decimal"
                                autoComplete="off"
                                required
                            />
                        </Field>
                    )}
                    <Field label="Date" htmlFor="time-date" className={mode === 'range' ? 'col-span-2 sm:col-span-1' : ''}>
                        <Input id="time-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} max={today()} required />
                    </Field>
                    <Field label="Note" htmlFor="time-note" hint="Optional" className="col-span-2 sm:col-span-1">
                        <Input id="time-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
                    </Field>
                    <Button type="submit" variant="primary" loading={saving} className="col-span-2 sm:col-span-1 sm:mt-6">
                        {saving ? 'Logging…' : 'Log time'}
                    </Button>
                </div>

                <ErrorMessage message={error} />
            </form>

            {task.timeEntries.length > 0 && (
                <table className="mt-3 w-full text-sm">
                    <caption className="sr-only">Time entries</caption>
                    <thead>
                        <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                            <th scope="col" className="py-1 font-medium">Date</th>
                            <th scope="col" className="py-1 font-medium">Who</th>
                            <th scope="col" className="py-1 text-right font-medium">Hours</th>
                            <th scope="col" className="hidden py-1 pl-3 font-medium sm:table-cell">Note</th>
                            <th scope="col" className="py-1"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {task.timeEntries.map((entry) => (
                            <tr key={entry.id}>
                                <td className="py-1.5 whitespace-nowrap">
                                    {formatDate(entry.date)}
                                    {entry.startTime && entry.endTime && (
                                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                                            {formatTime(entry.startTime)}–{formatTime(entry.endTime)}
                                        </span>
                                    )}
                                </td>
                                <td className="py-1.5">{entry.userName}</td>
                                <td className="py-1.5 text-right tabular-nums">{formatHours(entry.hours)}</td>
                                <td className="hidden py-1.5 pl-3 text-zinc-600 sm:table-cell dark:text-zinc-400">{entry.note}</td>
                                <td className="py-1.5 text-right">
                                    {(entry.userId === currentUser.id || currentUser.role === 'admin') && (
                                        <button
                                            type="button"
                                            onClick={() => run(`remove-${entry.id}`, () => onDelete(entry.id))}
                                            disabled={isBusy(`remove-${entry.id}`)}
                                            aria-busy={isBusy(`remove-${entry.id}`) || undefined}
                                            className="inline-flex items-center gap-1 rounded px-1.5 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950 dark:hover:text-red-300"
                                        >
                                            {isBusy(`remove-${entry.id}`) && <Spinner className="h-3 w-3" />}
                                            {isBusy(`remove-${entry.id}`) ? 'Removing…' : 'Remove'}
                                            <span className="sr-only"> {formatHours(entry.hours)} on {formatDate(entry.date)}</span>
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

import { useState } from 'react';
import { useRouter } from 'next/router';

import Button from '@/components/ui/Button';
import ColorPicker from '@/components/ui/ColorPicker';
import { ErrorMessage, Field, Input, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';

/**
 * One editable column row.
 *
 * @param {Object} props
 * @param {import('@/server/projects').Status} props.status
 * @param {boolean} props.isFirst
 * @param {boolean} props.isLast
 * @param {(statusId: number, changes: Object) => void} props.onUpdate
 * @param {(statusId: number) => void} props.onDelete
 * @returns {JSX.Element}
 */
function StatusRow({ status, isFirst, isLast, onUpdate, onDelete }) {
    const [name, setName] = useState(status.name);
    const [color, setColor] = useState(status.color);

    return (
        <li className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
            <label className="sr-only" htmlFor={`status-color-${status.id}`}>Color for {status.name}</label>
            <input
                id={`status-color-${status.id}`}
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                onBlur={() => color !== status.color && onUpdate(status.id, { color })}
                className="h-8 w-8 cursor-pointer rounded border border-zinc-300 bg-transparent dark:border-zinc-700"
            />
            <label className="sr-only" htmlFor={`status-name-${status.id}`}>Column name</label>
            <Input
                id={`status-name-${status.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => name.trim() && name !== status.name && onUpdate(status.id, { name })}
                maxLength={50}
                className="w-40 flex-1"
            />
            <label className="flex items-center gap-1.5 text-sm">
                <input
                    type="checkbox"
                    checked={status.isDone}
                    onChange={(event) => onUpdate(status.id, { isDone: event.target.checked })}
                    className="h-4 w-4 accent-violet-600"
                />
                Counts as done
            </label>
            <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={isFirst} onClick={() => onUpdate(status.id, { move: -1 })}>
                    <span aria-hidden="true">←</span>
                    <span className="sr-only">Move {status.name} left</span>
                </Button>
                <Button size="sm" variant="ghost" disabled={isLast} onClick={() => onUpdate(status.id, { move: 1 })}>
                    <span aria-hidden="true">→</span>
                    <span className="sr-only">Move {status.name} right</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(status.id)} className="text-red-700 dark:text-red-400">
                    Delete<span className="sr-only"> {status.name}</span>
                </Button>
            </div>
        </li>
    );
}

/**
 * Board settings: details, columns, and deletion.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {import('@/server/projects').Project} props.project
 * @param {import('@/server/projects').Status[]} props.statuses
 * @param {boolean} props.canDelete
 * @param {(project: import('@/server/projects').Project) => void} props.onProjectChange
 * @param {(statuses: import('@/server/projects').Status[]) => void} props.onStatusesChange
 * @returns {JSX.Element}
 */
export default function BoardSettingsModal({ open, onClose, project, statuses, canDelete, onProjectChange, onStatusesChange }) {
    const router = useRouter();
    const [color, setColor] = useState(project.color);
    const [newStatus, setNewStatus] = useState('');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    async function run(request) {
        setError(null);

        try {
            return await request();
        } catch (requestError) {
            setError(requestError.message);
            return null;
        }
    }

    async function saveDetails(event) {
        event.preventDefault();
        setSaving(true);

        const form = new FormData(event.currentTarget);
        const updated = await run(() =>
            api(`/api/projects/${project.id}`, {
                method: 'PATCH',
                body: { name: form.get('name'), description: form.get('description'), color },
            })
        );

        setSaving(false);

        if (updated) {
            onProjectChange(updated);
            router.replace(router.asPath, undefined, { scroll: false });
        }
    }

    async function updateStatus(statusId, changes) {
        const updated = await run(() => api(`/api/statuses/${statusId}`, { method: 'PATCH', body: changes }));

        if (updated) {
            onStatusesChange(updated);
        }
    }

    async function deleteStatus(statusId) {
        const updated = await run(() => api(`/api/statuses/${statusId}`, { method: 'DELETE' }));

        if (updated) {
            onStatusesChange(updated);
        }
    }

    async function addStatus(event) {
        event.preventDefault();

        if (!newStatus.trim()) {
            return;
        }

        const created = await run(() =>
            api(`/api/projects/${project.id}/statuses`, { method: 'POST', body: { name: newStatus } })
        );

        if (created) {
            onStatusesChange([...statuses, created]);
            setNewStatus('');
        }
    }

    async function deleteBoard() {
        if (!window.confirm(`Delete the board “${project.name}” and all of its tasks and time entries? This can't be undone.`)) {
            return;
        }

        const result = await run(() => api(`/api/projects/${project.id}`, { method: 'DELETE' }));

        if (result) {
            router.push('/boards');
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="Board settings" size="lg">
            <div className="space-y-8">
                <form onSubmit={saveDetails} className="space-y-4">
                    <Field label="Name" htmlFor="settings-name">
                        <Input id="settings-name" name="name" defaultValue={project.name} required maxLength={100} />
                    </Field>
                    <Field label="Description" htmlFor="settings-description">
                        <Textarea id="settings-description" name="description" defaultValue={project.description} rows={2} maxLength={1000} />
                    </Field>
                    <ColorPicker name="settings-color" value={color} onChange={setColor} />
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Saving…' : 'Save details'}
                    </Button>
                </form>

                <section aria-labelledby="columns-heading" className="space-y-3">
                    <div>
                        <h3 id="columns-heading" className="text-sm font-semibold">Columns</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Tasks in a “done” column count as completed in dashboards. Only empty columns can be deleted.
                        </p>
                    </div>
                    <ul className="space-y-2">
                        {statuses.map((status, index) => (
                            <StatusRow
                                key={status.id}
                                status={status}
                                isFirst={index === 0}
                                isLast={index === statuses.length - 1}
                                onUpdate={updateStatus}
                                onDelete={deleteStatus}
                            />
                        ))}
                    </ul>
                    <form onSubmit={addStatus} className="flex gap-2">
                        <label htmlFor="new-status" className="sr-only">New column name</label>
                        <Input
                            id="new-status"
                            value={newStatus}
                            onChange={(event) => setNewStatus(event.target.value)}
                            placeholder="New column name"
                            maxLength={50}
                        />
                        <Button type="submit">Add column</Button>
                    </form>
                </section>

                <ErrorMessage message={error} />

                {canDelete && (
                    <section aria-labelledby="danger-heading" className="rounded-lg border border-red-200 p-4 dark:border-red-900">
                        <h3 id="danger-heading" className="text-sm font-semibold text-red-800 dark:text-red-300">Delete board</h3>
                        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Removes the board with all its tasks, comments and time entries.</p>
                        <Button variant="danger" size="sm" className="mt-3" onClick={deleteBoard}>
                            Delete this board
                        </Button>
                    </section>
                )}
            </div>
        </Modal>
    );
}

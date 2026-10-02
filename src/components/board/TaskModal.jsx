import { useEffect, useRef, useState } from 'react';

import Button from '@/components/ui/Button';
import { ErrorMessage, Field, Input, Select, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import Spinner from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { PRIORITIES } from '@/lib/constants';
import { formatTimestamp } from '@/lib/format';
import { useBusy } from '@/lib/useBusy';

import Comments from './Comments';
import TimeLog from './TimeLog';

/**
 * The editable fields of an open task. Text fields save on blur; selects
 * and dates save as soon as they change.
 *
 * @param {Object} props
 * @param {import('@/server/tasks').TaskDetail} props.task
 * @param {import('@/server/projects').Status[]} props.statuses
 * @param {import('@/server/users').User[]} props.users
 * @param {(changes: Object) => Promise<void>} props.onSave
 * @returns {JSX.Element}
 */
function TaskFields({ task, statuses, users, onSave }) {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description);
    const [estimate, setEstimate] = useState(task.estimateHours ?? '');

    return (
        <div className="space-y-4">
            <Field label="Title" htmlFor="task-title">
                <Input
                    id="task-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onBlur={() => title.trim() && title !== task.title && onSave({ title })}
                    maxLength={200}
                    required
                    className="text-base font-medium"
                />
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Status" htmlFor="task-status">
                    <Select id="task-status" value={task.statusId} onChange={(event) => onSave({ statusId: Number(event.target.value) })}>
                        {statuses.map((status) => (
                            <option key={status.id} value={status.id}>{status.name}</option>
                        ))}
                    </Select>
                </Field>
                <Field label="Priority" htmlFor="task-priority">
                    <Select id="task-priority" value={task.priority} onChange={(event) => onSave({ priority: event.target.value })}>
                        {PRIORITIES.map((priority) => (
                            <option key={priority.value} value={priority.value}>{priority.label}</option>
                        ))}
                    </Select>
                </Field>
                <Field label="Assignee" htmlFor="task-assignee">
                    <Select
                        id="task-assignee"
                        value={task.assigneeId ?? ''}
                        onChange={(event) => onSave({ assigneeId: event.target.value ? Number(event.target.value) : null })}
                    >
                        <option value="">Unassigned</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                    </Select>
                </Field>
                <Field label="Due date" htmlFor="task-due">
                    <Input
                        id="task-due"
                        type="date"
                        value={task.dueDate ?? ''}
                        onChange={(event) => onSave({ dueDate: event.target.value || null })}
                    />
                </Field>
                <Field label="Estimate (hours)" htmlFor="task-estimate">
                    <Input
                        id="task-estimate"
                        type="number"
                        min="0"
                        step="0.25"
                        value={estimate}
                        onChange={(event) => setEstimate(event.target.value)}
                        onBlur={() => {
                            const next = estimate === '' ? null : Number(estimate);

                            if (next !== task.estimateHours) {
                                onSave({ estimateHours: next });
                            }
                        }}
                    />
                </Field>
            </div>

            <Field label="Description" htmlFor="task-description">
                <Textarea
                    id="task-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    onBlur={() => description !== task.description && onSave({ description })}
                    rows={4}
                    maxLength={10000}
                    placeholder="Add details…"
                />
            </Field>
        </div>
    );
}

/**
 * Placeholder in the shape of the task panel while it loads.
 *
 * @returns {JSX.Element}
 */
function TaskSkeleton() {
    return (
        <div role="status" aria-label="Loading task" className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ))}
            </div>
            <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        </div>
    );
}

/**
 * "Saving…" / "All changes saved" for fields that save automatically.
 *
 * @param {Object} props
 * @param {boolean} props.saving
 * @param {boolean} props.hasSaved
 * @returns {JSX.Element}
 */
function SaveStatus({ saving, hasSaved }) {
    return (
        <p role="status" className="flex h-5 items-center justify-end gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {saving && (
                <>
                    <Spinner className="h-3.5 w-3.5" />
                    Saving…
                </>
            )}
            {!saving && hasSaved && (
                <>
                    <span aria-hidden="true">✓</span>
                    All changes saved
                </>
            )}
        </p>
    );
}

/**
 * Task detail dialog: fields, time tracking and comments. Mount it only
 * while a task is open, keyed by task id, so each task starts fresh.
 *
 * @param {Object} props
 * @param {number} props.taskId
 * @param {import('@/server/projects').Status[]} props.statuses
 * @param {import('@/server/users').User[]} props.users
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {() => void} props.onClose
 * @param {(task: import('@/server/tasks').TaskDetail) => void} props.onChange - Called with fresh data after every save.
 * @param {(taskId: number) => void} props.onDelete
 * @returns {JSX.Element}
 */
export default function TaskModal({ taskId, statuses, users, currentUser, onClose, onChange, onDelete }) {
    const [task, setTask] = useState(null);
    const [error, setError] = useState(null);
    const [pendingSaves, setPendingSaves] = useState(0);
    const [hasSaved, setHasSaved] = useState(false);
    // Field saves run one after another so a slow request can't overwrite a newer edit.
    const saveQueue = useRef(Promise.resolve());
    const queuedSaves = useRef(0);
    const { run, isBusy } = useBusy();

    useEffect(() => {
        let ignore = false;

        api(`/api/tasks/${taskId}`)
            .then((data) => {
                if (!ignore) {
                    setTask(data);
                }
            })
            .catch((requestError) => {
                if (!ignore) {
                    setError(requestError.message);
                }
            });

        return () => {
            ignore = true;
        };
    }, [taskId]);

    /**
     * Sends a request that returns the updated task and syncs it everywhere.
     *
     * @param {string} url
     * @param {'POST'|'PATCH'|'DELETE'} method
     * @param {Object} [body]
     */
    async function mutate(url, method, body) {
        const updated = await api(url, { method, body });

        setTask(updated);
        onChange(updated);
    }

    function save(changes) {
        setError(null);
        setPendingSaves((count) => count + 1);
        // Show the edit straight away; the server's response replaces it when it arrives.
        setTask((current) => ({ ...current, ...changes }));
        queuedSaves.current += 1;

        saveQueue.current = saveQueue.current.then(async () => {
            try {
                const updated = await api(`/api/tasks/${taskId}`, { method: 'PATCH', body: changes });

                onChange(updated);
                setHasSaved(true);

                // An older response would briefly undo edits that are still queued.
                if (queuedSaves.current === 1) {
                    setTask(updated);
                }
            } catch (requestError) {
                setError(requestError.message);

                // Put the fields back to what is actually stored.
                try {
                    setTask(await api(`/api/tasks/${taskId}`));
                } catch (reloadError) {
                    console.error('Reloading the task after a failed save failed:', reloadError);
                }
            } finally {
                queuedSaves.current -= 1;
                setPendingSaves((count) => count - 1);
            }
        });

        return saveQueue.current;
    }

    async function removeTimeEntry(entryId) {
        setError(null);

        try {
            await mutate(`/api/time-entries/${entryId}`, 'DELETE');
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    function deleteTask() {
        if (!window.confirm(`Delete “${task.title}”? This also removes its time entries and comments.`)) {
            return;
        }

        run('delete', async () => {
            setError(null);

            try {
                await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
                onDelete(taskId);
            } catch (requestError) {
                setError(requestError.message);
            }
        });
    }

    return (
        <Modal open onClose={onClose} title={task?.title ?? 'Task'} size="lg">
            {!task && !error && <TaskSkeleton />}

            <ErrorMessage message={error} />

            {task && (
                <div className="space-y-6">
                    <SaveStatus saving={pendingSaves > 0} hasSaved={hasSaved} />

                    <TaskFields key={task.id} task={task} statuses={statuses} users={users} onSave={save} />

                    <TimeLog
                        task={task}
                        currentUser={currentUser}
                        onAdd={(entry) => mutate(`/api/tasks/${taskId}/time`, 'POST', entry)}
                        onDelete={removeTimeEntry}
                    />

                    <Comments
                        comments={task.comments}
                        onAdd={(body) => mutate(`/api/tasks/${taskId}/comments`, 'POST', { body })}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        <p>
                            Created {task.creatorName ? `by ${task.creatorName} ` : ''}on {formatTimestamp(task.createdAt)}
                        </p>
                        <Button variant="ghost" size="sm" onClick={deleteTask} loading={isBusy('delete')} className="text-red-700 dark:text-red-400">
                            {isBusy('delete') ? 'Deleting…' : 'Delete task'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

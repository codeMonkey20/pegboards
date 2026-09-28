import { useEffect, useState } from 'react';

import Button from '@/components/ui/Button';
import { ErrorMessage, Field, Input, Select, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { PRIORITIES } from '@/lib/constants';
import { formatTimestamp } from '@/lib/format';

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

    async function save(changes) {
        setError(null);

        try {
            await mutate(`/api/tasks/${taskId}`, 'PATCH', changes);
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function removeTimeEntry(entryId) {
        setError(null);

        try {
            await mutate(`/api/time-entries/${entryId}`, 'DELETE');
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    async function deleteTask() {
        if (!window.confirm(`Delete “${task.title}”? This also removes its time entries and comments.`)) {
            return;
        }

        try {
            await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
            onDelete(taskId);
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    return (
        <Modal open onClose={onClose} title={task?.title ?? 'Task'} size="lg">
            {!task && !error && <p className="py-8 text-center text-sm text-zinc-500" role="status">Loading task…</p>}

            <ErrorMessage message={error} />

            {task && (
                <div className="space-y-6">
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
                        <Button variant="ghost" size="sm" onClick={deleteTask} className="text-red-700 dark:text-red-400">
                            Delete task
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}

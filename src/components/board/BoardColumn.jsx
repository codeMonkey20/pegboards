import { useState } from 'react';

import TaskCard from './TaskCard';

/**
 * Inline "add a task" form at the bottom of a column.
 *
 * @param {Object} props
 * @param {string} props.statusName
 * @param {(title: string) => Promise<void>} props.onCreate
 * @returns {JSX.Element}
 */
function QuickAdd({ statusName, onCreate }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();

        if (!title.trim()) {
            return;
        }

        setSaving(true);

        try {
            await onCreate(title.trim());
            setTitle('');
        } finally {
            setSaving(false);
        }
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
                + Add task<span className="sr-only"> to {statusName}</span>
            </button>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <label htmlFor={`quick-add-${statusName}`} className="sr-only">
                New task in {statusName}
            </label>
            <input
                id={`quick-add-${statusName}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        setOpen(false);
                    }
                }}
                autoFocus
                maxLength={200}
                placeholder="Task name, then Enter"
                disabled={saving}
                className="w-full rounded-md border border-violet-400 bg-white px-2.5 py-2 text-sm focus:outline-2 focus:outline-violet-500/40 dark:bg-zinc-900"
            />
            <div className="mt-1.5 flex gap-2">
                <button type="submit" disabled={saving} className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700">
                    Add
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800">
                    Cancel
                </button>
            </div>
        </form>
    );
}

/**
 * One status column of the board.
 *
 * @param {Object} props
 * @param {import('@/server/projects').Status} props.status
 * @param {import('@/server/tasks').TaskSummary[]} props.tasks - Visible tasks, in order.
 * @param {number} props.totalCount - Tasks in the column before filtering.
 * @param {Map<number, import('@/server/users').User>} props.usersById
 * @param {number|null} props.draggingTaskId
 * @param {number|null} props.dropIndex - Where the drop marker shows, if this column is the target.
 * @param {(taskId: number) => void} props.onOpenTask
 * @param {(event: React.DragEvent, taskId: number) => void} props.onDragStart
 * @param {() => void} props.onDragEnd
 * @param {(event: React.DragEvent, statusId: number) => void} props.onDragOver
 * @param {(event: React.DragEvent, statusId: number) => void} props.onDrop
 * @param {(statusId: number, title: string) => Promise<void>} props.onCreateTask
 * @returns {JSX.Element}
 */
export default function BoardColumn({
    status,
    tasks,
    totalCount,
    usersById,
    draggingTaskId,
    dropIndex,
    onOpenTask,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    onCreateTask,
}) {
    const hoursLogged = tasks.reduce((sum, task) => sum + task.hoursLogged, 0);
    const marker = <div aria-hidden="true" className="h-1 rounded-full bg-violet-500" />;

    // Drop indexes ignore the card being dragged, so map each other card to its slot.
    const slots = new Map(
        tasks.filter((task) => task.id !== draggingTaskId).map((task, index) => [task.id, index])
    );

    return (
        <section
            aria-labelledby={`column-${status.id}`}
            className="relative flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-zinc-100 dark:bg-zinc-900"
        >
            <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                <h2 id={`column-${status.id}`} className="truncate text-sm font-semibold">
                    {status.name}
                </h2>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {tasks.length === totalCount ? totalCount : `${tasks.length}/${totalCount}`}
                    <span className="sr-only"> tasks</span>
                </span>
                {status.isDone && (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">
                        <span aria-hidden="true">✓ </span>Done
                    </span>
                )}
                {hoursLogged > 0 && (
                    <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">{Math.round(hoursLogged * 10) / 10}h</span>
                )}
            </header>

            <div
                onDragOver={(event) => onDragOver(event, status.id)}
                onDrop={(event) => onDrop(event, status.id)}
                className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
            >
                {tasks.map((task) => (
                    <div key={task.id} className="flex flex-col gap-2">
                        {dropIndex !== null && dropIndex === slots.get(task.id) && marker}
                        <TaskCard
                            task={task}
                            assignee={usersById.get(task.assigneeId)}
                            isDone={status.isDone}
                            isDragging={draggingTaskId === task.id}
                            onOpen={onOpenTask}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                        />
                    </div>
                ))}
                {dropIndex !== null && dropIndex >= slots.size && marker}

                <QuickAdd statusName={status.name} onCreate={(title) => onCreateTask(status.id, title)} />
            </div>
        </section>
    );
}

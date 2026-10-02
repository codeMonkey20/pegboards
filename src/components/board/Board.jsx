import { useRef, useState } from 'react';

import { ErrorMessage, Input, Select } from '@/components/ui/Field';
import Spinner from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { PRIORITIES } from '@/lib/constants';
import { useBusy } from '@/lib/useBusy';

import BoardColumn from './BoardColumn';
import TaskModal from './TaskModal';

/**
 * @typedef {Object} BoardFilters
 * @property {string} search
 * @property {string} assignee - 'all', 'me', 'none' or a user id.
 * @property {string} priority - 'all' or a priority value.
 */

/**
 * @param {import('@/server/tasks').TaskSummary} task
 * @param {BoardFilters} filters
 * @param {number} currentUserId
 * @returns {boolean}
 */
function matchesFilters(task, filters, currentUserId) {
    if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
    }

    if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
    }

    if (filters.assignee === 'me') {
        return task.assigneeId === currentUserId;
    }

    if (filters.assignee === 'none') {
        return task.assigneeId === null;
    }

    if (filters.assignee !== 'all') {
        return task.assigneeId === Number(filters.assignee);
    }

    return true;
}

/**
 * Picks the fields the board keeps from a full task response.
 *
 * @param {import('@/server/tasks').TaskSummary} task
 * @returns {import('@/server/tasks').TaskSummary}
 */
function toSummary(task) {
    const { id, projectId, statusId, title, priority, assigneeId, dueDate, estimateHours, position, hoursLogged, commentCount, completedAt } = task;

    return { id, projectId, statusId, title, priority, assigneeId, dueDate, estimateHours, position, hoursLogged, commentCount, completedAt };
}

/**
 * Interactive Kanban board: columns, drag and drop, filters and the task dialog.
 *
 * @param {Object} props
 * @param {import('@/server/projects').Status[]} props.statuses
 * @param {import('@/server/tasks').TaskSummary[]} props.initialTasks
 * @param {import('@/server/users').User[]} props.users
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {number|null} [props.initialOpenTaskId] - Task to open on load (from a `?task=` link).
 * @returns {JSX.Element}
 */
export default function Board({ statuses, initialTasks, users, currentUser, initialOpenTaskId = null }) {
    const [tasks, setTasks] = useState(initialTasks);
    const [filters, setFilters] = useState({ search: '', assignee: 'all', priority: 'all' });
    const [openTaskId, setOpenTaskId] = useState(initialOpenTaskId);
    const [dragging, setDragging] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [error, setError] = useState(null);
    const { run, isBusy, anyBusy } = useBusy();
    // Moves are sent one at a time so the server applies them in the order
    // they were made; only the last response replaces the board's tasks.
    const moveQueue = useRef(Promise.resolve());
    const pendingMoves = useRef(0);

    const usersById = new Map(users.map((user) => [user.id, user]));
    const isFiltered = filters.search !== '' || filters.assignee !== 'all' || filters.priority !== 'all';

    const columns = statuses.map((status) => {
        const all = tasks
            .filter((task) => task.statusId === status.id)
            .sort((a, b) => a.position - b.position);

        return {
            status,
            all,
            visible: all.filter((task) => matchesFilters(task, filters, currentUser.id)),
        };
    });

    /** @param {Partial<BoardFilters>} changes */
    function updateFilters(changes) {
        setFilters((current) => ({ ...current, ...changes }));
    }

    async function createTask(statusId, title) {
        setError(null);

        try {
            const task = await api('/api/tasks', { method: 'POST', body: { statusId, title } });
            setTasks((current) => [...current, task]);
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    function handleDragStart(event, taskId) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(taskId));
        setDragging(taskId);
    }

    function handleDragEnd() {
        setDragging(null);
        setDropTarget(null);
    }

    /**
     * Works out the drop slot from the pointer's position relative to the
     * midpoints of the other cards in the column.
     */
    function handleDragOver(event, statusId) {
        if (dragging === null) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const cards = [...event.currentTarget.querySelectorAll('[data-task-id]')].filter(
            (card) => Number(card.dataset.taskId) !== dragging
        );
        const index = cards.filter((card) => {
            const rect = card.getBoundingClientRect();
            return event.clientY > rect.top + rect.height / 2;
        }).length;

        if (dropTarget?.statusId !== statusId || dropTarget?.index !== index) {
            setDropTarget({ statusId, index });
        }
    }

    async function handleDrop(event, statusId) {
        event.preventDefault();

        const taskId = dragging;
        const column = columns.find((item) => item.status.id === statusId);

        handleDragEnd();

        if (taskId === null || !column || !dropTarget) {
            return;
        }

        // The drop slot is among *visible* cards; translate it to a slot
        // among all cards so filtered-out tasks keep their place.
        const visible = column.visible.filter((task) => task.id !== taskId);
        const all = column.all.filter((task) => task.id !== taskId);
        const anchor = visible[dropTarget.index];
        const lastVisible = visible[visible.length - 1];
        let index = all.length;

        if (anchor) {
            index = all.indexOf(anchor);
        } else if (lastVisible) {
            index = all.indexOf(lastVisible) + 1;
        }

        const moved = tasks.find((task) => task.id === taskId);
        const reordered = [...all.slice(0, index), { ...moved, statusId }, ...all.slice(index)];
        const positions = new Map(reordered.map((task, position) => [task.id, position]));
        const previous = tasks;

        setTasks((current) =>
            current.map((task) =>
                positions.has(task.id)
                    ? { ...task, statusId: task.id === taskId ? statusId : task.statusId, position: positions.get(task.id) }
                    : task
            )
        );

        setError(null);

        run(`move-${taskId}`, () => {
            pendingMoves.current += 1;

            const request = moveQueue.current.then(async () => {
                const isLatest = () => pendingMoves.current === 1;

                try {
                    const saved = await api(`/api/tasks/${taskId}/move`, { method: 'POST', body: { statusId, index } });

                    if (isLatest()) {
                        setTasks(saved);
                    }
                } catch (requestError) {
                    if (isLatest()) {
                        setTasks(previous);
                    }

                    setError(`Couldn't move the task: ${requestError.message}`);
                } finally {
                    pendingMoves.current -= 1;
                }
            });

            moveQueue.current = request;

            return request;
        });
    }

    function handleTaskChange(updated) {
        setTasks((current) => current.map((task) => (task.id === updated.id ? toSummary(updated) : task)));
    }

    function handleTaskDelete(taskId) {
        setTasks((current) => current.filter((task) => task.id !== taskId));
        setOpenTaskId(null);
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Filter tasks">
                <div className="w-full sm:w-64">
                    <label htmlFor="filter-search" className="sr-only">Search tasks</label>
                    <Input
                        id="filter-search"
                        type="search"
                        value={filters.search}
                        onChange={(event) => updateFilters({ search: event.target.value })}
                        placeholder="Search tasks…"
                    />
                </div>
                <div>
                    <label htmlFor="filter-assignee" className="sr-only">Assignee</label>
                    <Select id="filter-assignee" value={filters.assignee} onChange={(event) => updateFilters({ assignee: event.target.value })}>
                        <option value="all">Everyone</option>
                        <option value="me">Assigned to me</option>
                        <option value="none">Unassigned</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                    </Select>
                </div>
                <div>
                    <label htmlFor="filter-priority" className="sr-only">Priority</label>
                    <Select id="filter-priority" value={filters.priority} onChange={(event) => updateFilters({ priority: event.target.value })}>
                        <option value="all">Any priority</option>
                        {PRIORITIES.map((priority) => (
                            <option key={priority.value} value={priority.value}>{priority.label}</option>
                        ))}
                    </Select>
                </div>
                {isFiltered && (
                    <button
                        type="button"
                        onClick={() => setFilters({ search: '', assignee: 'all', priority: 'all' })}
                        className="h-10 px-2 text-sm text-violet-700 hover:underline dark:text-violet-300"
                    >
                        Clear filters
                    </button>
                )}
                <p role="status" className="ml-auto flex h-10 items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {anyBusy && (
                        <>
                            <Spinner />
                            Saving…
                        </>
                    )}
                </p>
            </div>

            <ErrorMessage message={error} />

            <p className="sr-only">
                Drag cards between columns to change their status, or open a task and change its Status field.
            </p>

            <div className="relative -mx-4 flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
                {columns.map(({ status, all, visible }) => (
                    <BoardColumn
                        key={status.id}
                        status={status}
                        tasks={visible}
                        totalCount={all.length}
                        usersById={usersById}
                        draggingTaskId={dragging}
                        isTaskBusy={(taskId) => isBusy(`move-${taskId}`)}
                        dropIndex={dropTarget?.statusId === status.id ? dropTarget.index : null}
                        onOpenTask={setOpenTaskId}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onCreateTask={createTask}
                    />
                ))}
            </div>

            {openTaskId !== null && (
                <TaskModal
                    key={openTaskId}
                    taskId={openTaskId}
                    statuses={statuses}
                    users={users}
                    currentUser={currentUser}
                    onClose={() => setOpenTaskId(null)}
                    onChange={handleTaskChange}
                    onDelete={handleTaskDelete}
                />
            )}
        </div>
    );
}

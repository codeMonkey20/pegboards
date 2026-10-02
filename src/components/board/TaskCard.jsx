import Avatar from '@/components/ui/Avatar';
import PriorityFlag from '@/components/ui/PriorityFlag';
import Spinner from '@/components/ui/Spinner';
import { today } from '@/lib/dates';
import { formatDate, formatHours } from '@/lib/format';

/**
 * A task on the board. The whole card is draggable and clickable with a
 * mouse; the title is a real button so keyboard and screen reader users
 * can open it too.
 *
 * @param {Object} props
 * @param {import('@/server/tasks').TaskSummary} props.task
 * @param {import('@/server/users').User|undefined} props.assignee
 * @param {boolean} props.isDone
 * @param {boolean} props.isDragging
 * @param {boolean} [props.isSaving=false] - Its move is still saving; it can't be dragged again until then.
 * @param {(taskId: number) => void} props.onOpen
 * @param {(event: React.DragEvent, taskId: number) => void} props.onDragStart
 * @param {() => void} props.onDragEnd
 * @returns {JSX.Element}
 */
export default function TaskCard({ task, assignee, isDone, isDragging, isSaving = false, onOpen, onDragStart, onDragEnd }) {
    const isOverdue = !isDone && task.dueDate && task.dueDate < today();
    const hasTime = task.hoursLogged > 0 || task.estimateHours;

    return (
        <div
            draggable={!isSaving}
            aria-busy={isSaving || undefined}
            data-task-id={task.id}
            onDragStart={(event) => onDragStart(event, task.id)}
            onDragEnd={onDragEnd}
            onClick={() => onOpen(task.id)}
            className={`relative rounded-lg ${isSaving ? 'cursor-progress' : 'cursor-grab'} border border-zinc-200 bg-white p-3 shadow-sm transition hover:border-zinc-300 hover:shadow active:cursor-grabbing dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 ${
                isDragging ? 'opacity-40' : ''
            }`}
        >
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onOpen(task.id);
                }}
                className={`block w-full text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${isSaving ? 'pr-5' : ''} ${
                    isDone ? 'text-zinc-500 line-through dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'
                }`}
            >
                {task.title}
            </button>

            {isSaving && (
                <span className="absolute top-2 right-2 text-violet-600 dark:text-violet-400">
                    <Spinner className="h-3.5 w-3.5" />
                    <span className="sr-only">Saving move</span>
                </span>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <PriorityFlag priority={task.priority} hideNormal />

                {task.dueDate && (
                    <span className={isOverdue ? 'font-medium text-red-700 dark:text-red-400' : ''}>
                        {isOverdue ? 'Overdue · ' : 'Due '}
                        {formatDate(task.dueDate)}
                    </span>
                )}

                {hasTime && (
                    <span title="Hours logged / estimate">
                        <span aria-hidden="true">⏱ </span>
                        {formatHours(task.hoursLogged)}
                        {task.estimateHours ? ` / ${formatHours(task.estimateHours)}` : ''}
                    </span>
                )}

                {task.commentCount > 0 && (
                    <span>
                        <span aria-hidden="true">💬 </span>
                        {task.commentCount}
                        <span className="sr-only"> comments</span>
                    </span>
                )}

                {assignee && (
                    <span className="ml-auto">
                        <Avatar name={assignee.name} color={assignee.color} />
                    </span>
                )}
            </div>
        </div>
    );
}

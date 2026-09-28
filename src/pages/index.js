import Link from 'next/link';

import AppLayout from '@/components/layout/AppLayout';
import PriorityFlag from '@/components/ui/PriorityFlag';
import { addDays, today, toISODate } from '@/lib/dates';
import { formatDate, formatHours } from '@/lib/format';
import { computeMetric } from '@/server/metrics';
import { withPageAuth } from '@/server/page';
import { listAssignedTasks } from '@/server/tasks';

/**
 * @typedef {ReturnType<typeof listAssignedTasks>[number]} AssignedTask
 */

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {string} [props.note]
 * @returns {JSX.Element}
 */
function StatTile({ label, value, note }) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
            {note && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{note}</p>}
        </div>
    );
}

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {AssignedTask[]} props.tasks
 * @param {boolean} [props.overdue=false]
 * @returns {JSX.Element|null}
 */
function TaskGroup({ title, tasks, overdue = false }) {
    if (tasks.length === 0) {
        return null;
    }

    return (
        <section aria-labelledby={`group-${title}`}>
            <h2 id={`group-${title}`} className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {title} <span className="font-normal text-zinc-500">({tasks.length})</span>
            </h2>
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {tasks.map((task) => (
                    <li key={task.id}>
                        <Link
                            href={`/boards/${task.projectId}?task=${task.id}`}
                            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-600 dark:hover:bg-zinc-800/60"
                        >
                            <span className="min-w-0 flex-1 basis-60 truncate font-medium">{task.title}</span>
                            <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                                <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ backgroundColor: task.projectColor }} />
                                {task.projectName}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: task.statusColor }} />
                                {task.statusName}
                            </span>
                            <PriorityFlag priority={task.priority} hideNormal />
                            {task.dueDate && (
                                <span className={`text-xs ${overdue ? 'font-medium text-red-700 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                    {overdue ? 'Overdue · ' : 'Due '}
                                    {formatDate(task.dueDate)}
                                </span>
                            )}
                            {task.hoursLogged > 0 && (
                                <span className="text-xs text-zinc-600 dark:text-zinc-400">{formatHours(task.hoursLogged)} logged</span>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Home page: the signed-in person's open tasks and this week's hours.
 *
 * @param {Object} props
 * @param {AssignedTask[]} props.tasks
 * @param {number} props.hoursThisWeek
 * @param {number} props.hoursLastWeek
 * @param {string} props.todayISO
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {import('@/server/page').NavData} props.nav
 * @returns {JSX.Element}
 */
export default function HomePage({ tasks, hoursThisWeek, hoursLastWeek, todayISO, currentUser, nav }) {
    const weekFromNow = toISODate(addDays(new Date(`${todayISO}T00:00:00`), 7));
    const overdue = tasks.filter((task) => task.dueDate && task.dueDate < todayISO);
    const dueSoon = tasks.filter((task) => task.dueDate && task.dueDate >= todayISO && task.dueDate <= weekFromNow);
    const later = tasks.filter((task) => !task.dueDate || task.dueDate > weekFromNow);

    return (
        <AppLayout title="My work" subtitle={`Hi ${currentUser.name.split(' ')[0]}, here's what's on your plate.`} currentUser={currentUser} nav={nav}>
            <div className="space-y-8">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatTile label="Hours logged this week" value={formatHours(hoursThisWeek)} note={`Same days last week: ${formatHours(hoursLastWeek)}`} />
                    <StatTile label="Open tasks assigned to you" value={String(tasks.length)} />
                    <StatTile label="Overdue" value={String(overdue.length)} note={overdue.length > 0 ? 'Needs attention' : 'All on track'} />
                </div>

                {tasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                        <p className="font-medium">Nothing assigned to you</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Head to <Link href="/boards" className="text-violet-700 underline dark:text-violet-300">Boards</Link> to pick something up.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <TaskGroup title="Overdue" tasks={overdue} overdue />
                        <TaskGroup title="Due in the next 7 days" tasks={dueSoon} />
                        <TaskGroup title="Later or no due date" tasks={later} />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

export const getServerSideProps = withPageAuth(({ user }) => {
    const hours = computeMetric(
        {
            metric: 'hours_logged',
            groupBy: 'none',
            chart: 'number',
            filters: { dateRange: 'this_week', projectIds: [], userIds: [user.id], priorities: [], completion: 'any' },
        },
        user.id
    );

    return {
        props: {
            tasks: listAssignedTasks(user.id),
            hoursThisWeek: hours.total ?? 0,
            hoursLastWeek: hours.previousTotal ?? 0,
            todayISO: today(),
        },
    };
});

import { useState } from 'react';

import Board from '@/components/board/Board';
import BoardSettingsModal from '@/components/board/BoardSettingsModal';
import AppLayout from '@/components/layout/AppLayout';
import Button from '@/components/ui/Button';
import { getProject, listStatuses } from '@/server/projects';
import { withPageAuth } from '@/server/page';
import { listBoardTasks } from '@/server/tasks';
import { listUsers } from '@/server/users';

/**
 * @typedef {Object} BoardPageProps
 * @property {import('@/server/projects').Project} project
 * @property {import('@/server/projects').Status[]} statuses
 * @property {import('@/server/tasks').TaskSummary[]} tasks
 * @property {import('@/server/users').User[]} users
 * @property {number|null} openTaskId
 * @property {import('@/server/auth').SessionUser} currentUser
 * @property {import('@/server/page').NavData} nav
 */

/**
 * Holds the board's editable state. Keyed by board id in the page so
 * switching boards starts from fresh props.
 *
 * @param {BoardPageProps} props
 * @returns {JSX.Element}
 */
function BoardView({ project: initialProject, statuses: initialStatuses, tasks, users, openTaskId, currentUser, nav }) {
    const [project, setProject] = useState(initialProject);
    const [statuses, setStatuses] = useState(initialStatuses);
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <AppLayout
            title={project.name}
            subtitle={project.description || undefined}
            currentUser={currentUser}
            nav={nav}
            fullWidth
            actions={<Button onClick={() => setSettingsOpen(true)}>Board settings</Button>}
        >
            <Board statuses={statuses} initialTasks={tasks} users={users} currentUser={currentUser} initialOpenTaskId={openTaskId} />

            {settingsOpen && (
                <BoardSettingsModal
                    open
                    onClose={() => setSettingsOpen(false)}
                    project={project}
                    statuses={statuses}
                    canDelete={currentUser.role === 'admin'}
                    onProjectChange={setProject}
                    onStatusesChange={setStatuses}
                />
            )}
        </AppLayout>
    );
}

/**
 * Kanban board page.
 *
 * @param {BoardPageProps} props
 * @returns {JSX.Element}
 */
export default function BoardPage(props) {
    return <BoardView key={props.project.id} {...props} />;
}

export const getServerSideProps = withPageAuth(async ({ context }) => {
    const id = Number(context.params.id);
    const project = Number.isInteger(id) ? await getProject(id) : null;

    if (!project) {
        return { notFound: true };
    }

    const tasks = await listBoardTasks(id);
    const requestedTaskId = Number(context.query.task);

    return {
        props: {
            project,
            statuses: await listStatuses(id),
            tasks,
            users: await listUsers(),
            openTaskId: tasks.some((task) => task.id === requestedTaskId) ? requestedTaskId : null,
        },
    };
});

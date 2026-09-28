import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import AppLayout from '@/components/layout/AppLayout';
import Button from '@/components/ui/Button';
import ColorPicker from '@/components/ui/ColorPicker';
import { ErrorMessage, Field, Input, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { COLORS } from '@/lib/constants';
import { withPageAuth } from '@/server/page';
import { listProjects } from '@/server/projects';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @returns {JSX.Element}
 */
function NewBoardModal({ open, onClose }) {
    const router = useRouter();
    const [color, setColor] = useState(COLORS[0]);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setSaving(true);

        const form = new FormData(event.currentTarget);

        try {
            const { id } = await api('/api/projects', {
                method: 'POST',
                body: { name: form.get('name'), description: form.get('description'), color },
            });
            router.push(`/boards/${id}`);
        } catch (requestError) {
            setError(requestError.message);
            setSaving(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title="New board">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Name" htmlFor="board-name">
                    <Input id="board-name" name="name" required maxLength={100} autoFocus />
                </Field>
                <Field label="Description" htmlFor="board-description" hint="Optional.">
                    <Textarea id="board-description" name="description" rows={2} maxLength={1000} />
                </Field>
                <ColorPicker name="board-color" value={color} onChange={setColor} />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    New boards start with To do, In progress, Review and Done columns. You can change them later.
                </p>
                <ErrorMessage message={error} />
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Creating…' : 'Create board'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

/**
 * Lists every board in the workspace.
 *
 * @param {Object} props
 * @param {ReturnType<typeof listProjects>} props.projects
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {import('@/server/page').NavData} props.nav
 * @returns {JSX.Element}
 */
export default function BoardsPage({ projects, currentUser, nav }) {
    const [creating, setCreating] = useState(false);

    return (
        <AppLayout
            title="Boards"
            currentUser={currentUser}
            nav={nav}
            actions={
                <Button variant="primary" onClick={() => setCreating(true)}>
                    + New board
                </Button>
            }
        >
            {projects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                    <p className="font-medium">No boards yet</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Create a board to start tracking tasks.</p>
                    <Button variant="primary" className="mt-4" onClick={() => setCreating(true)}>
                        Create your first board
                    </Button>
                </div>
            ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                        <li key={project.id}>
                            <Link
                                href={`/boards/${project.id}`}
                                className="block h-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-zinc-800 dark:bg-zinc-900"
                            >
                                <div className="flex items-center gap-2">
                                    <span aria-hidden="true" className="h-3 w-3 rounded-sm" style={{ backgroundColor: project.color }} />
                                    <h2 className="truncate font-semibold">{project.name}</h2>
                                </div>
                                {project.description && (
                                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{project.description}</p>
                                )}
                                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                                    {project.openCount} open · {project.taskCount} total
                                </p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            <NewBoardModal open={creating} onClose={() => setCreating(false)} />
        </AppLayout>
    );
}

export const getServerSideProps = withPageAuth(async () => ({
    props: { projects: await listProjects() },
}));

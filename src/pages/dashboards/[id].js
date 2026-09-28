import { useState } from 'react';
import { useRouter } from 'next/router';

import WidgetCard from '@/components/dashboard/WidgetCard';
import WidgetEditor from '@/components/dashboard/WidgetEditor';
import AppLayout from '@/components/layout/AppLayout';
import Button from '@/components/ui/Button';
import { ErrorMessage, Field, Input } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { listWidgets, requireDashboard } from '@/server/dashboards';
import { HttpError } from '@/server/http';
import { withPageAuth } from '@/server/page';
import { listProjects } from '@/server/projects';
import { listUsers } from '@/server/users';

/**
 * @typedef {Object} DashboardPageProps
 * @property {import('@/server/dashboards').Dashboard & { canEdit: boolean }} dashboard
 * @property {import('@/server/dashboards').Widget[]} widgets
 * @property {{ id: number, name: string }[]} projects
 * @property {{ id: number, name: string }[]} users
 * @property {import('@/server/auth').SessionUser} currentUser
 * @property {import('@/server/page').NavData} nav
 */

/**
 * Rename, share or delete a dashboard.
 *
 * @param {Object} props
 * @param {DashboardPageProps['dashboard']} props.dashboard
 * @param {() => void} props.onClose
 * @returns {JSX.Element}
 */
function DashboardSettingsModal({ dashboard, onClose }) {
    const router = useRouter();
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setSaving(true);

        const form = new FormData(event.currentTarget);

        try {
            await api(`/api/dashboards/${dashboard.id}`, {
                method: 'PATCH',
                body: { name: form.get('name'), isShared: form.get('shared') === 'on' },
            });
            await router.replace(router.asPath, undefined, { scroll: false });
            onClose();
        } catch (requestError) {
            setError(requestError.message);
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!window.confirm(`Delete the dashboard “${dashboard.name}”?`)) {
            return;
        }

        try {
            await api(`/api/dashboards/${dashboard.id}`, { method: 'DELETE' });
            router.push('/dashboards');
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    return (
        <Modal open onClose={onClose} title="Dashboard settings">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Name" htmlFor="dashboard-settings-name">
                    <Input id="dashboard-settings-name" name="name" defaultValue={dashboard.name} required maxLength={100} />
                </Field>
                <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="shared" defaultChecked={dashboard.isShared} className="mt-0.5 h-4 w-4 accent-violet-600" />
                    <span>
                        Share with the team
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            Teammates can view it but not edit it. Widgets filtered to “Me” show each viewer their own numbers.
                        </span>
                    </span>
                </label>
                <ErrorMessage message={error} />
                <div className="flex flex-wrap justify-between gap-2">
                    <Button variant="ghost" onClick={handleDelete} className="text-red-700 dark:text-red-400">
                        Delete dashboard
                    </Button>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

/**
 * @param {DashboardPageProps} props
 * @returns {JSX.Element}
 */
function DashboardView({ dashboard, widgets: initialWidgets, projects, users, currentUser, nav }) {
    const [widgets, setWidgets] = useState(initialWidgets);
    // null = closed, 'new' = adding, a widget = editing it.
    const [editing, setEditing] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [error, setError] = useState(null);

    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    const userNames = new Map(users.map((user) => [user.id, user.name]));

    async function saveWidget(values) {
        if (editing === 'new') {
            const created = await api(`/api/dashboards/${dashboard.id}/widgets`, { method: 'POST', body: values });
            setWidgets((current) => [...current, created]);
        } else {
            const updated = await api(`/api/widgets/${editing.id}`, { method: 'PATCH', body: values });
            setWidgets((current) => current.map((widget) => (widget.id === updated.id ? updated : widget)));
        }

        setEditing(null);
    }

    function moveWidget(index, direction) {
        const target = index + direction;
        const previous = widgets;
        const reordered = [...widgets];

        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        setWidgets(reordered);
        setError(null);

        api(`/api/widgets/${widgets[index].id}`, { method: 'PATCH', body: { move: direction } }).catch((requestError) => {
            setWidgets(previous);
            setError(requestError.message);
        });
    }

    async function deleteWidget(widget) {
        if (!window.confirm(`Remove “${widget.title}” from this dashboard?`)) {
            return;
        }

        try {
            setError(null);
            await api(`/api/widgets/${widget.id}`, { method: 'DELETE' });
            setWidgets((current) => current.filter((item) => item.id !== widget.id));
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    const ownership = dashboard.ownerId === currentUser.id ? 'Your dashboard' : `Shared by ${dashboard.ownerName}`;

    return (
        <AppLayout
            title={dashboard.name}
            subtitle={`${ownership}${dashboard.isShared ? ' · visible to the team' : ' · private'}`}
            currentUser={currentUser}
            nav={nav}
            actions={
                dashboard.canEdit && (
                    <>
                        <Button onClick={() => setSettingsOpen(true)}>Settings</Button>
                        <Button variant="primary" onClick={() => setEditing('new')}>+ Add widget</Button>
                    </>
                )
            }
        >
            <div className="space-y-4">
                <ErrorMessage message={error} />

                {widgets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                        <p className="font-medium">This dashboard is empty</p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Add widgets like “Hours logged this week by person” or “Overdue tasks on the Website board”.
                        </p>
                        {dashboard.canEdit && (
                            <Button variant="primary" className="mt-4" onClick={() => setEditing('new')}>
                                Add your first widget
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                        {widgets.map((widget, index) => (
                            <WidgetCard
                                key={widget.id}
                                widget={widget}
                                canEdit={dashboard.canEdit}
                                isFirst={index === 0}
                                isLast={index === widgets.length - 1}
                                projectNames={projectNames}
                                userNames={userNames}
                                onEdit={() => setEditing(widget)}
                                onMove={(direction) => moveWidget(index, direction)}
                                onDelete={() => deleteWidget(widget)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {editing && (
                <WidgetEditor
                    key={editing === 'new' ? 'new' : editing.id}
                    widget={editing === 'new' ? null : editing}
                    projects={projects}
                    users={users}
                    onClose={() => setEditing(null)}
                    onSave={saveWidget}
                />
            )}

            {settingsOpen && <DashboardSettingsModal dashboard={dashboard} onClose={() => setSettingsOpen(false)} />}
        </AppLayout>
    );
}

/**
 * A custom metrics dashboard.
 *
 * @param {DashboardPageProps} props
 * @returns {JSX.Element}
 */
export default function DashboardPage(props) {
    return <DashboardView key={props.dashboard.id} {...props} />;
}

export const getServerSideProps = withPageAuth(async ({ context, user }) => {
    const id = Number(context.params.id);

    if (!Number.isInteger(id)) {
        return { notFound: true };
    }

    try {
        const dashboard = await requireDashboard(id, user);

        return {
            props: {
                dashboard,
                widgets: await listWidgets(id, user.id),
                projects: (await listProjects()).map(({ id: projectId, name }) => ({ id: projectId, name })),
                users: (await listUsers()).map(({ id: userId, name }) => ({ id: userId, name })),
            },
        };
    } catch (error) {
        if (error instanceof HttpError && error.status === 404) {
            return { notFound: true };
        }

        throw error;
    }
});

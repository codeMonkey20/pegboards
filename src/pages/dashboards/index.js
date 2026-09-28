import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import AppLayout from '@/components/layout/AppLayout';
import Button from '@/components/ui/Button';
import { ErrorMessage, Field, Input } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { listDashboards } from '@/server/dashboards';
import { withPageAuth } from '@/server/page';

/**
 * @param {Object} props
 * @param {() => void} props.onClose
 * @returns {JSX.Element}
 */
function NewDashboardModal({ onClose }) {
    const router = useRouter();
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setSaving(true);

        try {
            const { id } = await api('/api/dashboards', {
                method: 'POST',
                body: { name: new FormData(event.currentTarget).get('name') },
            });
            router.push(`/dashboards/${id}`);
        } catch (requestError) {
            setError(requestError.message);
            setSaving(false);
        }
    }

    return (
        <Modal open onClose={onClose} title="New dashboard">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Name" htmlFor="dashboard-name">
                    <Input id="dashboard-name" name="name" required maxLength={100} autoFocus placeholder="e.g. Weekly hours" />
                </Field>
                <ErrorMessage message={error} />
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="primary" disabled={saving}>
                        {saving ? 'Creating…' : 'Create dashboard'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

/**
 * Lists the viewer's dashboards and ones teammates shared.
 *
 * @param {Object} props
 * @param {import('@/server/dashboards').Dashboard[]} props.dashboards
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {import('@/server/page').NavData} props.nav
 * @returns {JSX.Element}
 */
export default function DashboardsPage({ dashboards, currentUser, nav }) {
    const [creating, setCreating] = useState(false);

    return (
        <AppLayout
            title="Dashboards"
            currentUser={currentUser}
            nav={nav}
            actions={<Button variant="primary" onClick={() => setCreating(true)}>+ New dashboard</Button>}
        >
            {dashboards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                    <p className="font-medium">No dashboards yet</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        Build a dashboard of hours logged, tasks completed, overdue work and more.
                    </p>
                    <Button variant="primary" className="mt-4" onClick={() => setCreating(true)}>
                        Create a dashboard
                    </Button>
                </div>
            ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {dashboards.map((dashboard) => (
                        <li key={dashboard.id}>
                            <Link
                                href={`/dashboards/${dashboard.id}`}
                                className="block h-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-zinc-800 dark:bg-zinc-900"
                            >
                                <h2 className="truncate font-semibold">{dashboard.name}</h2>
                                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    {dashboard.widgetCount} {dashboard.widgetCount === 1 ? 'widget' : 'widgets'}
                                    {' · '}
                                    {dashboard.ownerId === currentUser.id ? 'Yours' : `By ${dashboard.ownerName}`}
                                    {dashboard.isShared && ' · Shared with team'}
                                </p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            {creating && <NewDashboardModal onClose={() => setCreating(false)} />}
        </AppLayout>
    );
}

export const getServerSideProps = withPageAuth(async ({ user }) => ({
    props: { dashboards: await listDashboards(user.id) },
}));

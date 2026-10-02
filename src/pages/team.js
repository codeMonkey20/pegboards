import { useState } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ColorPicker from '@/components/ui/ColorPicker';
import { ErrorMessage, Field, Input, Select } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { useBusy } from '@/lib/useBusy';
import { withPageAuth } from '@/server/page';
import { listUsers } from '@/server/users';

/**
 * Add a new person, or edit an existing one.
 *
 * @param {Object} props
 * @param {import('@/server/users').User|null} props.user - Null when adding.
 * @param {boolean} props.isAdmin
 * @param {boolean} props.isSelf
 * @param {() => void} props.onClose
 * @param {(user: import('@/server/users').User) => void} props.onSaved
 * @returns {JSX.Element}
 */
function UserModal({ user, isAdmin, isSelf, onClose, onSaved }) {
    const [color, setColor] = useState(user?.color ?? '#2a78d6');
    const [error, setError] = useState(null);
    const { run, isBusy } = useBusy();
    const saving = isBusy('save');

    function handleSubmit(event) {
        event.preventDefault();

        const form = new FormData(event.currentTarget);
        const body = { name: form.get('name'), email: form.get('email') };
        const password = form.get('password');

        if (password) {
            body.password = password;
        }

        if (isAdmin && !isSelf) {
            body.role = form.get('role');
        }

        run('save', async () => {
            setError(null);

            try {
                const saved = user
                    ? await api(`/api/users/${user.id}`, { method: 'PATCH', body: { ...body, color } })
                    : await api('/api/users', { method: 'POST', body });
                onSaved(saved);
            } catch (requestError) {
                setError(requestError.message);
            }
        });
    }

    return (
        <Modal open onClose={onClose} title={user ? `Edit ${user.name}` : 'Add a teammate'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Name" htmlFor="user-name">
                    <Input id="user-name" name="name" defaultValue={user?.name} required maxLength={100} />
                </Field>
                <Field label="Email" htmlFor="user-email">
                    <Input id="user-email" name="email" type="email" defaultValue={user?.email} required />
                </Field>
                <Field
                    label={user ? 'New password' : 'Temporary password'}
                    htmlFor="user-password"
                    hint={user ? 'Leave blank to keep the current password.' : 'At least 8 characters. Share it with them privately.'}
                >
                    <Input id="user-password" name="password" type="password" autoComplete="new-password" minLength={8} required={!user} />
                </Field>
                {isAdmin && !isSelf && (
                    <Field label="Role" htmlFor="user-role" hint="Admins can manage people and delete boards.">
                        <Select id="user-role" name="role" defaultValue={user?.role ?? 'member'}>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </Select>
                    </Field>
                )}
                {user && <ColorPicker name="user-color" label="Avatar color" value={color} onChange={setColor} />}
                <ErrorMessage message={error} />
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" variant="primary" loading={saving}>
                        {saving ? 'Saving…' : user ? 'Save' : 'Add teammate'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

/**
 * Team members. Admins can add, edit and deactivate people; everyone can edit themselves.
 *
 * @param {Object} props
 * @param {import('@/server/users').User[]} props.users
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {import('@/server/page').NavData} props.nav
 * @returns {JSX.Element}
 */
export default function TeamPage({ users: initialUsers, currentUser, nav }) {
    const [users, setUsers] = useState(initialUsers);
    // null = closed, 'new' = adding, a user = editing them.
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState(null);
    const { run, isBusy } = useBusy();
    const isAdmin = currentUser.role === 'admin';

    function handleSaved(saved) {
        setUsers((current) =>
            current.some((user) => user.id === saved.id)
                ? current.map((user) => (user.id === saved.id ? saved : user))
                : [...current, saved]
        );
        setEditing(null);
    }

    function toggleActive(user) {
        const verb = user.isActive ? 'Deactivate' : 'Reactivate';

        if (user.isActive && !window.confirm(`${verb} ${user.name}? They'll be signed out and can't sign in. Their tasks and time stay.`)) {
            return;
        }

        run(user.id, async () => {
            setError(null);

            try {
                handleSaved(await api(`/api/users/${user.id}`, { method: 'PATCH', body: { isActive: !user.isActive } }));
            } catch (requestError) {
                setError(requestError.message);
            }
        });
    }

    return (
        <AppLayout
            title="Team"
            currentUser={currentUser}
            nav={nav}
            actions={isAdmin && <Button variant="primary" onClick={() => setEditing('new')}>+ Add teammate</Button>}
        >
            <ErrorMessage message={error} />

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-sm">
                    <caption className="sr-only">Team members</caption>
                    <thead>
                        <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                            <th scope="col" className="px-4 py-2 font-medium">Name</th>
                            <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">Email</th>
                            <th scope="col" className="px-4 py-2 font-medium">Role</th>
                            <th scope="col" className="px-4 py-2"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {users.map((user) => {
                            const isSelf = user.id === currentUser.id;
                            const isToggling = isBusy(user.id);

                            return (
                                <tr key={user.id} className={user.isActive ? '' : 'text-zinc-400 dark:text-zinc-500'}>
                                    <td className="px-4 py-2.5">
                                        <span className="flex items-center gap-2">
                                            <Avatar name={user.name} color={user.color} />
                                            <span className="truncate font-medium">{user.name}</span>
                                            {isSelf && <span className="text-xs text-zinc-500">(you)</span>}
                                            {!user.isActive && <span className="rounded bg-zinc-100 px-1.5 text-xs dark:bg-zinc-800">Deactivated</span>}
                                        </span>
                                    </td>
                                    <td className="hidden px-4 py-2.5 sm:table-cell">{user.email}</td>
                                    <td className="px-4 py-2.5 capitalize">{user.role}</td>
                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                        {(isAdmin || isSelf) && (
                                            <Button size="sm" variant="ghost" onClick={() => setEditing(user)} disabled={isToggling}>
                                                Edit<span className="sr-only"> {user.name}</span>
                                            </Button>
                                        )}
                                        {isAdmin && !isSelf && (
                                            <Button size="sm" variant="ghost" onClick={() => toggleActive(user)} loading={isToggling}>
                                                {isToggling && (user.isActive ? 'Deactivating…' : 'Reactivating…')}
                                                {!isToggling && (user.isActive ? 'Deactivate' : 'Reactivate')}
                                                <span className="sr-only"> {user.name}</span>
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {editing && (
                <UserModal
                    user={editing === 'new' ? null : editing}
                    isAdmin={isAdmin}
                    isSelf={editing !== 'new' && editing.id === currentUser.id}
                    onClose={() => setEditing(null)}
                    onSaved={handleSaved}
                />
            )}
        </AppLayout>
    );
}

export const getServerSideProps = withPageAuth(async ({ user }) => ({
    props: { users: await listUsers({ includeInactive: user.role === 'admin' }) },
}));

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import Avatar from '@/components/ui/Avatar';
import { api } from '@/lib/api';

/**
 * @param {Object} props
 * @param {string} props.href
 * @param {boolean} props.active
 * @param {() => void} props.onNavigate
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
function NavLink({ href, active, onNavigate, children }) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-sm ${
                active
                    ? 'bg-violet-100 font-medium text-violet-900 dark:bg-violet-500/20 dark:text-violet-100'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
        >
            {children}
        </Link>
    );
}

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.href - "See all" link.
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
function NavSection({ title, href, children }) {
    return (
        <div className="mt-6">
            <div className="mb-1 flex items-center justify-between px-2.5">
                <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{title}</h2>
                <Link href={href} className="text-xs text-violet-700 hover:underline dark:text-violet-300">
                    All<span className="sr-only"> {title.toLowerCase()}</span>
                </Link>
            </div>
            <ul className="space-y-0.5">{children}</ul>
        </div>
    );
}

/**
 * App navigation. Fixed on large screens, a slide-over drawer on small ones.
 *
 * @param {Object} props
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {import('@/server/page').NavData} props.nav
 * @param {boolean} props.open - Drawer state on small screens.
 * @param {() => void} props.onClose
 * @returns {JSX.Element}
 */
export default function Sidebar({ currentUser, nav, open, onClose }) {
    const router = useRouter();
    const [signingOut, setSigningOut] = useState(false);
    const path = router.asPath.split('?')[0];

    async function signOut() {
        setSigningOut(true);

        try {
            await api('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Sign-out request failed:', error);
        }

        router.push('/login');
    }

    return (
        <>
            {open && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={onClose}
                    className="fixed inset-0 z-30 bg-zinc-950/40 lg:hidden"
                />
            )}

            <nav
                aria-label="Main"
                className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900 ${
                    open ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex items-center gap-2 px-4 py-4">
                    <span aria-hidden="true" className="grid h-7 w-7 grid-cols-2 gap-0.5 rounded-md bg-violet-600 p-1.5">
                        <span className="rounded-full bg-white" />
                        <span className="rounded-full bg-white/60" />
                        <span className="rounded-full bg-white/60" />
                        <span className="rounded-full bg-white" />
                    </span>
                    <Link href="/" className="text-base font-bold tracking-tight" onClick={onClose}>
                        Pegboards
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-4">
                    <ul className="space-y-0.5">
                        <li>
                            <NavLink onNavigate={onClose} href="/" active={path === '/'}>My work</NavLink>
                        </li>
                        <li>
                            <NavLink onNavigate={onClose} href="/team" active={path === '/team'}>Team</NavLink>
                        </li>
                    </ul>

                    <NavSection title="Boards" href="/boards">
                        {nav.projects.map((project) => (
                            <li key={project.id}>
                                <NavLink onNavigate={onClose} href={`/boards/${project.id}`} active={path === `/boards/${project.id}`}>
                                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: project.color }} />
                                    <span className="truncate">{project.name}</span>
                                </NavLink>
                            </li>
                        ))}
                        {nav.projects.length === 0 && (
                            <li className="px-2.5 py-1 text-sm text-zinc-500 dark:text-zinc-400">No boards yet</li>
                        )}
                    </NavSection>

                    <NavSection title="Dashboards" href="/dashboards">
                        {nav.dashboards.map((dashboard) => (
                            <li key={dashboard.id}>
                                <NavLink onNavigate={onClose} href={`/dashboards/${dashboard.id}`} active={path === `/dashboards/${dashboard.id}`}>
                                    <span className="truncate">{dashboard.name}</span>
                                </NavLink>
                            </li>
                        ))}
                        {nav.dashboards.length === 0 && (
                            <li className="px-2.5 py-1 text-sm text-zinc-500 dark:text-zinc-400">No dashboards yet</li>
                        )}
                    </NavSection>
                </div>

                <div className="flex items-center gap-2 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
                    <Avatar name={currentUser.name} color={currentUser.color} size="md" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{currentUser.name}</p>
                        <p className="truncate text-xs text-zinc-500 capitalize dark:text-zinc-400">{currentUser.role}</p>
                    </div>
                    <button
                        type="button"
                        onClick={signOut}
                        disabled={signingOut}
                        className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                        Sign out
                    </button>
                </div>
            </nav>
        </>
    );
}

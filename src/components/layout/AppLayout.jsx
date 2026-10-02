import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import Skeleton from '@/components/ui/Skeleton';
import { pathOf, useRouteLoading } from '@/lib/useRouteLoading';

import PageSkeleton from './PageSkeleton';
import Sidebar from './Sidebar';

/**
 * Signed-in page shell: sidebar navigation plus a page header.
 *
 * @param {Object} props
 * @param {string} props.title - Page heading and document title.
 * @param {import('@/server/auth').SessionUser} props.currentUser
 * @param {import('@/server/page').NavData} props.nav
 * @param {React.ReactNode} [props.actions] - Buttons shown beside the heading.
 * @param {React.ReactNode} [props.subtitle]
 * @param {boolean} [props.fullWidth=false] - Fill the viewport (for boards): content uses the whole
 *   width and height, and scrolls inside itself rather than scrolling the page.
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function AppLayout({ title, currentUser, nav, actions, subtitle, fullWidth = false, children }) {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const loadingUrl = useRouteLoading();
    // Refreshing the current page (same path) keeps its content on screen;
    // only moving to another page swaps in a skeleton.
    const leavingTo = loadingUrl && pathOf(loadingUrl) !== pathOf(router.asPath) ? pathOf(loadingUrl) : null;

    return (
        <>
            <Head>
                <title>{`${title} | Pegboards`}</title>
            </Head>

            <div className={`flex ${fullWidth ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}>
                <Sidebar
                    currentUser={currentUser}
                    nav={nav}
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                />

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-900/90">
                        <button
                            type="button"
                            onClick={() => setMenuOpen(true)}
                            aria-label="Open navigation"
                            className="-ml-1 rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                                <path d="M3 5h14a1 1 0 1 0 0-2H3a1 1 0 0 0 0 2Zm14 4H3a1 1 0 0 0 0 2h14a1 1 0 1 0 0-2Zm0 6H3a1 1 0 0 0 0 2h14a1 1 0 1 0 0-2Z" />
                            </svg>
                        </button>
                        {leavingTo ? (
                            <div className="min-w-0 flex-1 space-y-1.5 py-1">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        ) : (
                            <>
                                <div className="min-w-0 flex-1">
                                    <h1 className="truncate text-lg font-semibold">{title}</h1>
                                    {subtitle && <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
                                </div>
                                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                            </>
                        )}
                    </header>

                    <main className={`flex-1 p-4 sm:p-6 ${fullWidth ? 'flex min-h-0 min-w-0 flex-col' : 'mx-auto w-full max-w-6xl'}`}>
                        {leavingTo ? <PageSkeleton path={leavingTo} /> : children}
                    </main>
                </div>
            </div>
        </>
    );
}

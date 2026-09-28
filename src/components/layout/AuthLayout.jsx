import Head from 'next/head';

/**
 * Centered card layout for the sign-in and setup screens.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function AuthLayout({ title, description, children }) {
    return (
        <>
            <Head>
                <title>{`${title} | Pegboards`}</title>
            </Head>
            <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
                <div className="w-full max-w-sm">
                    <p className="mb-6 text-center text-xl font-bold tracking-tight text-violet-700 dark:text-violet-300">Pegboards</p>
                    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
                        {description && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
                        <div className="mt-5">{children}</div>
                    </div>
                </div>
            </main>
        </>
    );
}

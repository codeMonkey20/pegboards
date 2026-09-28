import Head from 'next/head';
import Link from 'next/link';

/**
 * Not-found page.
 *
 * @returns {JSX.Element}
 */
export default function NotFoundPage() {
    return (
        <>
            <Head>
                <title>Not found | Pegboards</title>
            </Head>
            <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 px-4 text-center dark:bg-zinc-950">
                <h1 className="text-2xl font-semibold">We couldn&apos;t find that page</h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">It may have been deleted, or you may not have access to it.</p>
                <Link href="/" className="mt-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
                    Go to My work
                </Link>
            </main>
        </>
    );
}

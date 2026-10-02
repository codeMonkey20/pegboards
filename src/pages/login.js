import { useState } from 'react';
import { useRouter } from 'next/router';

import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import { ErrorMessage, Field, Input } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { useBusy } from '@/lib/useBusy';
import { getSessionUser, needsSetup } from '@/server/auth';

/**
 * Only allows same-site relative redirects, so `?next=` can't send people elsewhere.
 *
 * @param {unknown} next
 * @returns {string}
 */
function safeRedirect(next) {
    return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/**
 * Sign-in page.
 *
 * @returns {JSX.Element}
 */
export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState(null);
    const { run, isBusy } = useBusy();
    const submitting = isBusy('submit');

    function handleSubmit(event) {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        // Stays busy until the next page has loaded, so it can't be submitted twice.
        run('submit', async () => {
            setError(null);

            try {
                await api('/api/auth/login', {
                    method: 'POST',
                    body: { email: form.get('email'), password: form.get('password') },
                });
                await router.push(safeRedirect(router.query.next));
            } catch (requestError) {
                setError(requestError.message);
            }
        });
    }

    return (
        <AuthLayout title="Sign in" description="Welcome back. Sign in to your workspace.">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email" htmlFor="email">
                    <Input id="email" name="email" type="email" autoComplete="email" required />
                </Field>
                <Field label="Password" htmlFor="password">
                    <Input id="password" name="password" type="password" autoComplete="current-password" required />
                </Field>
                <ErrorMessage message={error} />
                <Button type="submit" variant="primary" className="w-full" loading={submitting}>
                    {submitting ? 'Signing in…' : 'Sign in'}
                </Button>
                <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                    Need an account? Ask a workspace admin to add you.
                </p>
            </form>
        </AuthLayout>
    );
}

/**
 * Sends signed-in users home and fresh installs to setup.
 *
 * @param {import('next').GetServerSidePropsContext} context
 * @returns {Promise<Object>}
 */
export async function getServerSideProps(context) {
    if (await needsSetup()) {
        return { redirect: { destination: '/setup', permanent: false } };
    }

    if (await getSessionUser(context.req)) {
        return { redirect: { destination: '/', permanent: false } };
    }

    return { props: {} };
}

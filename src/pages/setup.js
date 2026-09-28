import { useState } from 'react';
import { useRouter } from 'next/router';

import AuthLayout from '@/components/layout/AuthLayout';
import Button from '@/components/ui/Button';
import { ErrorMessage, Field, Input } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { needsSetup } from '@/server/auth';
import { DEMO_PASSWORD } from '@/server/seed';

/**
 * First-run page that creates the admin account.
 *
 * @param {Object} props
 * @param {string} props.demoPassword
 * @returns {JSX.Element}
 */
export default function SetupPage({ demoPassword }) {
    const router = useRouter();
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        const form = new FormData(event.currentTarget);

        try {
            await api('/api/auth/setup', {
                method: 'POST',
                body: {
                    name: form.get('name'),
                    email: form.get('email'),
                    password: form.get('password'),
                    includeDemoData: form.get('demo') === 'on',
                },
            });
            router.push('/');
        } catch (requestError) {
            setError(requestError.message);
            setSubmitting(false);
        }
    }

    return (
        <AuthLayout title="Set up your workspace" description="Create the first account. It will be the workspace admin.">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Your name" htmlFor="name">
                    <Input id="name" name="name" autoComplete="name" required maxLength={100} />
                </Field>
                <Field label="Email" htmlFor="email">
                    <Input id="email" name="email" type="email" autoComplete="email" required />
                </Field>
                <Field label="Password" htmlFor="password" hint="At least 8 characters.">
                    <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
                </Field>
                <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input type="checkbox" name="demo" defaultChecked className="mt-0.5 h-4 w-4 accent-violet-600" />
                    <span>
                        Add sample boards, teammates and time entries
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                            Sample teammates sign in with password “{demoPassword}”.
                        </span>
                    </span>
                </label>
                <ErrorMessage message={error} />
                <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
                    {submitting ? 'Creating…' : 'Create workspace'}
                </Button>
            </form>
        </AuthLayout>
    );
}

/**
 * Setup only works while there are no accounts.
 *
 * @returns {Promise<Object>}
 */
export async function getServerSideProps() {
    if (!needsSetup()) {
        return { redirect: { destination: '/login', permanent: false } };
    }

    return { props: { demoPassword: DEMO_PASSWORD } };
}

import { useState } from 'react';

import Button from '@/components/ui/Button';
import { ErrorMessage, Textarea } from '@/components/ui/Field';
import { formatTimestamp } from '@/lib/format';
import { useBusy } from '@/lib/useBusy';

/**
 * A task's comment thread.
 *
 * @param {Object} props
 * @param {import('@/server/tasks').Comment[]} props.comments
 * @param {(body: string) => Promise<void>} props.onAdd
 * @returns {JSX.Element}
 */
export default function Comments({ comments, onAdd }) {
    const [body, setBody] = useState('');
    const [error, setError] = useState(null);
    const { run, isBusy } = useBusy();
    const saving = isBusy('post');

    function handleSubmit(event) {
        event.preventDefault();

        if (!body.trim()) {
            return;
        }

        run('post', async () => {
            setError(null);

            try {
                await onAdd(body.trim());
                setBody('');
            } catch (requestError) {
                setError(requestError.message);
            }
        });
    }

    return (
        <section aria-labelledby="comments-heading">
            <h3 id="comments-heading" className="text-sm font-semibold">
                Comments {comments.length > 0 && <span className="font-normal text-zinc-500">({comments.length})</span>}
            </h3>

            {comments.length > 0 && (
                <ol className="mt-2 space-y-3">
                    {comments.map((comment) => (
                        <li key={comment.id} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">{comment.userName}</span>
                                {' · '}
                                <time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>
                            </p>
                            <p className="mt-1 text-sm whitespace-pre-wrap">{comment.body}</p>
                        </li>
                    ))}
                </ol>
            )}

            <form onSubmit={handleSubmit} className="mt-3 space-y-2">
                <label htmlFor="new-comment" className="sr-only">Write a comment</label>
                <Textarea
                    id="new-comment"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={2}
                    maxLength={5000}
                    placeholder="Write a comment…"
                />
                <ErrorMessage message={error} />
                <div className="flex justify-end">
                    <Button type="submit" size="sm" variant="primary" loading={saving} disabled={!body.trim()}>
                        {saving ? 'Posting…' : 'Comment'}
                    </Button>
                </div>
            </form>
        </section>
    );
}

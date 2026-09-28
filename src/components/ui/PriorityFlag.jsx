import { PRIORITIES } from '@/lib/constants';

/**
 * Priority shown as a colored flag plus its name, so it never relies on color alone.
 *
 * @param {Object} props
 * @param {import('@/lib/constants').Priority} props.priority
 * @param {boolean} [props.hideNormal=false] - Skip rendering for "normal", to keep cards quiet.
 * @returns {JSX.Element|null}
 */
export default function PriorityFlag({ priority, hideNormal = false }) {
    const option = PRIORITIES.find((item) => item.value === priority);

    if (!option || (hideNormal && priority === 'normal')) {
        return null;
    }

    return (
        <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" style={{ color: option.color }} fill="currentColor">
                <path d="M3 1.75a.75.75 0 0 1 1.5 0V2h8.1a.5.5 0 0 1 .4.8L11 5.5l2 2.7a.5.5 0 0 1-.4.8H4.5v5.25a.75.75 0 0 1-1.5 0V1.75Z" />
            </svg>
            {option.label}
        </span>
    );
}

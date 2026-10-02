/**
 * Grey placeholder block shown while content loads. Hidden from screen
 * readers; the surrounding region should announce the loading state.
 *
 * @param {Object} props
 * @param {string} [props.className] - Size and shape, e.g. "h-4 w-32".
 * @returns {JSX.Element}
 */
export default function Skeleton({ className = '' }) {
    return <div aria-hidden="true" className={`rounded-md bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800 ${className}`} />;
}

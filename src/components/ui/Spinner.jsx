/**
 * Small spinning indicator. Decorative: pair it with visible or
 * screen-reader text that says what is happening.
 *
 * @param {Object} props
 * @param {string} [props.className='h-4 w-4']
 * @returns {JSX.Element}
 */
export default function Spinner({ className = 'h-4 w-4' }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`shrink-0 motion-safe:animate-spin ${className}`}>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

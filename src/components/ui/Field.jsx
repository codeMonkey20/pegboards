const CONTROL_CLASS =
    'block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-2 focus:outline-violet-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

/**
 * A labelled form control wrapper.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.htmlFor - Id of the control inside.
 * @param {string} [props.hint]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function Field({ label, htmlFor, hint, className = '', children }) {
    return (
        <div className={className}>
            <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {label}
            </label>
            {children}
            {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
        </div>
    );
}

/**
 * @param {React.InputHTMLAttributes<HTMLInputElement>} props
 * @returns {JSX.Element}
 */
export function Input({ className = '', ...rest }) {
    return <input className={`${CONTROL_CLASS} ${className}`} {...rest} />;
}

/**
 * @param {React.SelectHTMLAttributes<HTMLSelectElement>} props
 * @returns {JSX.Element}
 */
export function Select({ className = '', children, ...rest }) {
    return (
        <select className={`${CONTROL_CLASS} ${className}`} {...rest}>
            {children}
        </select>
    );
}

/**
 * @param {React.TextareaHTMLAttributes<HTMLTextAreaElement>} props
 * @returns {JSX.Element}
 */
export function Textarea({ className = '', ...rest }) {
    return <textarea className={`${CONTROL_CLASS} ${className}`} {...rest} />;
}

/**
 * Error text announced to screen readers when it appears.
 *
 * @param {Object} props
 * @param {string|null} props.message
 * @returns {JSX.Element|null}
 */
export function ErrorMessage({ message }) {
    if (!message) {
        return null;
    }

    return (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <span aria-hidden="true">⚠ </span>
            {message}
        </p>
    );
}

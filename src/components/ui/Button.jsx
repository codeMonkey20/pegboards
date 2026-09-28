const VARIANTS = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700 disabled:bg-violet-400',
    secondary:
        'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
    ghost: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400',
};

const SIZES = {
    sm: 'h-8 px-2.5 text-sm',
    md: 'h-10 px-4 text-sm',
};

/**
 * Standard button.
 *
 * @param {Object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant='secondary']
 * @param {'sm'|'md'} [props.size='md']
 * @param {'button'|'submit'} [props.type='button']
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function Button({ variant = 'secondary', size = 'md', type = 'button', className = '', children, ...rest }) {
    return (
        <button
            type={type}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-70 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}

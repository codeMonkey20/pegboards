import { useEffect, useId, useRef } from 'react';

const SIZES = {
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
};

/**
 * Modal dialog built on the native `<dialog>` element, which gives focus
 * trapping, Escape-to-close and a backdrop for free.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {'md'|'lg'|'xl'} [props.size='md']
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function Modal({ open, onClose, title, size = 'md', children }) {
    const dialogRef = useRef(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;

        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target === dialogRef.current) {
                    onClose();
                }
            }}
            className={`m-auto w-[calc(100%-2rem)] ${SIZES[size]} rounded-xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/50 dark:bg-zinc-900 dark:text-zinc-100`}
        >
            {open && (
                <div className="flex max-h-[85vh] flex-col">
                    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                        <h2 id={titleId} className="text-lg font-semibold">
                            {title}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="-m-1 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        >
                            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                                <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
                            </svg>
                        </button>
                    </div>
                    <div className="overflow-y-auto px-5 py-4">{children}</div>
                </div>
            )}
        </dialog>
    );
}

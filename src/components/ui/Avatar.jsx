import { initials } from '@/lib/format';

const SIZES = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
};

/**
 * Round initials badge for a person.
 *
 * @param {Object} props
 * @param {string} props.name
 * @param {string} props.color
 * @param {'sm'|'md'} [props.size='sm']
 * @returns {JSX.Element}
 */
export default function Avatar({ name, color, size = 'sm' }) {
    return (
        <span
            title={name}
            className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZES[size]}`}
            style={{ backgroundColor: color }}
        >
            <span aria-hidden="true">{initials(name)}</span>
            <span className="sr-only">{name}</span>
        </span>
    );
}

import { COLORS } from '@/lib/constants';

/**
 * Row of swatch radio buttons.
 *
 * @param {Object} props
 * @param {string} props.name - Radio group name; must be unique on the page.
 * @param {string} props.value
 * @param {(color: string) => void} props.onChange
 * @param {string} [props.label='Color']
 * @returns {JSX.Element}
 */
export default function ColorPicker({ name, value, onChange, label = 'Color' }) {
    return (
        <fieldset>
            <legend className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</legend>
            <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                    <label key={color} className="cursor-pointer">
                        <input
                            type="radio"
                            name={name}
                            value={color}
                            checked={value === color}
                            onChange={() => onChange(color)}
                            className="peer sr-only"
                        />
                        <span className="sr-only">{color}</span>
                        <span
                            aria-hidden="true"
                            className="block h-7 w-7 rounded-full ring-offset-2 ring-offset-white peer-checked:ring-2 peer-checked:ring-zinc-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-violet-600 dark:ring-offset-zinc-900 dark:peer-checked:ring-white"
                            style={{ backgroundColor: color }}
                        />
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

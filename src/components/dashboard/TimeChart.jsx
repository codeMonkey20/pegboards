import { useState } from 'react';

import { niceScale } from '@/lib/chart';
import { formatMetric } from '@/lib/format';

const HEIGHT = 160;

/**
 * Column or line chart over time. Drawn in HTML plus a stretched SVG
 * path so it stays crisp at any width; hovering a period shows its value.
 *
 * @param {Object} props
 * @param {{ key: string, label: string, value: number|null }[]} props.rows - Already labelled, oldest first.
 * @param {'hours'|'count'|'days'} props.unit
 * @param {'bar'|'line'} props.variant
 * @returns {JSX.Element}
 */
export default function TimeChart({ rows, unit, variant }) {
    const [hovered, setHovered] = useState(null);
    const { max, ticks } = niceScale(Math.max(...rows.map((row) => row.value ?? 0), 0));
    const count = rows.length;
    // Points sit at the centre of each period's slot, matching the columns and hover strips.
    const xFor = (index) => ((index + 0.5) / count) * 100;
    const yFor = (value) => 100 - ((value ?? 0) / max) * 100;
    const labelIndexes = new Set([0, Math.floor((count - 1) / 2), count - 1]);

    const linePoints = rows
        .map((row, index) => (row.value === null ? null : `${xFor(index)},${yFor(row.value)}`))
        .filter(Boolean)
        .join(' ');

    const hoveredRow = hovered !== null ? rows[hovered] : null;

    return (
        <div className="flex gap-2">
            <div className="relative w-10 shrink-0 text-right text-[11px] text-zinc-500 tabular-nums" style={{ height: HEIGHT }} aria-hidden="true">
                {ticks.map((tick) => (
                    <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${yFor(tick)}%` }}>
                        {formatMetric(tick, unit, { compact: true })}
                    </span>
                ))}
            </div>

            <div className="min-w-0 flex-1">
                <div className="relative" style={{ height: HEIGHT }} onMouseLeave={() => setHovered(null)}>
                    {ticks.map((tick) => (
                        <div
                            key={tick}
                            aria-hidden="true"
                            className={`absolute inset-x-0 border-t ${tick === 0 ? 'border-zinc-300 dark:border-zinc-600' : 'border-zinc-200 dark:border-zinc-800'}`}
                            style={{ top: `${yFor(tick)}%` }}
                        />
                    ))}

                    {variant === 'bar' ? (
                        <div className="absolute inset-0 flex items-end gap-[2px]">
                            {rows.map((row, index) => (
                                <div key={row.key} className="flex h-full flex-1 items-end justify-center">
                                    <div
                                        className={`w-full max-w-6 rounded-t ${hovered === index ? 'bg-[#1c5cab] dark:bg-[#6da7ec]' : 'bg-[#2a78d6] dark:bg-[#3987e5]'}`}
                                        style={{ height: `${100 - yFor(row.value)}%` }}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                                <polygon
                                    points={`${xFor(0)},100 ${linePoints} ${xFor(count - 1)},100`}
                                    className="fill-[#2a78d6]/10 dark:fill-[#3987e5]/15"
                                />
                                <polyline
                                    points={linePoints}
                                    fill="none"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    vectorEffect="non-scaling-stroke"
                                    className="stroke-[#2a78d6] dark:stroke-[#3987e5]"
                                />
                            </svg>
                            {hoveredRow && hoveredRow.value !== null && (
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2a78d6] ring-2 ring-white dark:bg-[#3987e5] dark:ring-zinc-900"
                                    style={{ left: `${xFor(hovered)}%`, top: `${yFor(hoveredRow.value)}%` }}
                                />
                            )}
                        </>
                    )}

                    {/* Invisible hover strips, one per period, wider than the marks. */}
                    <div className="absolute inset-0 flex">
                        {rows.map((row, index) => (
                            <div key={row.key} className="h-full flex-1" onMouseEnter={() => setHovered(index)} />
                        ))}
                    </div>

                    {hoveredRow && (
                        <div
                            role="status"
                            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs whitespace-nowrap shadow-md dark:border-zinc-700 dark:bg-zinc-800"
                            style={{ left: `${Math.min(Math.max(xFor(hovered), 15), 85)}%` }}
                        >
                            <span className="text-zinc-500 dark:text-zinc-400">{hoveredRow.label}</span>{' '}
                            <span className="font-semibold">{formatMetric(hoveredRow.value, unit)}</span>
                        </div>
                    )}
                </div>

                <div className="relative mt-1 h-4 text-[11px] text-zinc-500" aria-hidden="true">
                    {rows.map((row, index) =>
                        labelIndexes.has(index) ? (
                            <span
                                key={row.key}
                                className={`absolute whitespace-nowrap ${index === 0 ? 'left-0' : index === count - 1 ? 'right-0' : '-translate-x-1/2'}`}
                                style={index === 0 || index === count - 1 ? undefined : { left: `${xFor(index)}%` }}
                            >
                                {row.label}
                            </span>
                        ) : null
                    )}
                </div>
            </div>
        </div>
    );
}

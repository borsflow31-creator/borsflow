'use client';

import React, { useRef, useState } from 'react';

/**
 * Small dependency-free SVG charts for the developer dashboard.
 *
 * Every chart is one series family in one colour, with value labels printed on
 * the marks that matter, so identity never rests on colour alone. Colours are the
 * --viz-series-* tokens (globals.css), which swap with the theme; text stays in
 * the theme's text tokens and never takes the series colour. Marks are thin, the
 * baseline is the only axis line, and the grid is one faint step.
 */

export const SERIES = {
    one: 'var(--viz-series-1)',
    two: 'var(--viz-series-2)',
    three: 'var(--viz-series-3)',
} as const;

const GRID = 'rgb(var(--outline-variant) / 0.25)';
const MUTED = 'rgb(var(--on-surface-variant) / 0.75)';

/* ─── Tooltip ─────────────────────────────────────────────── */

interface TipState { x: number; y: number; title: string; lines: string[] }

function useTip() {
    const ref = useRef<HTMLDivElement>(null);
    const [tip, setTip] = useState<TipState | null>(null);

    const show = (e: React.MouseEvent | React.FocusEvent, title: string, lines: string[]) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        const target = e.currentTarget.getBoundingClientRect();
        setTip({ x: target.left + target.width / 2 - box.left, y: target.top - box.top, title, lines });
    };
    const hide = () => setTip(null);

    const node = tip && (
        <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full -mt-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-2.5 py-1.5 shadow-lg whitespace-nowrap"
            style={{ left: tip.x, top: tip.y }}
        >
            <p className="text-[11px] font-semibold text-on-surface">{tip.title}</p>
            {tip.lines.map((line) => (
                <p key={line} className="text-[11px] text-on-surface-variant">{line}</p>
            ))}
        </div>
    );
    return { ref, show, hide, node };
}

/* ─── Column chart (collections forecast) ─────────────────── */

export interface ColumnDatum { label: string; value: number; tipTitle?: string }

export function ColumnChart({
    data, color = SERIES.one, formatValue, height = 160,
}: {
    data: ColumnDatum[];
    color?: string;
    formatValue: (n: number) => string;
    height?: number;
}) {
    const { ref, show, hide, node } = useTip();
    const max = Math.max(...data.map((d) => d.value), 0);
    const labelH = 18;
    const valueH = 16;
    const plotH = height - labelH - valueH;

    return (
        <div ref={ref} className="relative">
            <div className="flex items-end gap-2" style={{ height }}>
                {data.map((d) => {
                    const h = max > 0 ? Math.max(d.value > 0 ? 3 : 0, (d.value / max) * plotH) : 0;
                    return (
                        <button
                            type="button"
                            key={d.label}
                            className="group flex-1 min-w-0 flex flex-col items-center justify-end focus:outline-none"
                            style={{ height }}
                            onMouseEnter={(e) => show(e, d.tipTitle ?? d.label, [formatValue(d.value)])}
                            onMouseLeave={hide}
                            onFocus={(e) => show(e, d.tipTitle ?? d.label, [formatValue(d.value)])}
                            onBlur={hide}
                            aria-label={`${d.tipTitle ?? d.label}: ${formatValue(d.value)}`}
                        >
                            <span className="text-[10px] tabular-nums text-on-surface-variant mb-1" style={{ height: valueH, lineHeight: `${valueH}px` }}>
                                {d.value > 0 ? formatValue(d.value) : ''}
                            </span>
                            <span
                                className="w-full max-w-[36px] transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                                style={{ height: h, background: color, borderRadius: '4px 4px 0 0' }}
                            />
                            <span className="text-[10px] text-on-surface-variant mt-1" style={{ height: labelH, lineHeight: `${labelH - 2}px` }}>
                                {d.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            <div className="h-px -mt-[18px] mb-[17px]" style={{ background: GRID }} />
            {node}
        </div>
    );
}

/* ─── Line chart (sales trend) ────────────────────────────── */

export interface LinePoint { label: string; value: number; tipTitle: string; tipLines: string[] }

export function LineChart({
    data, color = SERIES.one, formatValue, height = 190,
}: {
    data: LinePoint[];
    color?: string;
    formatValue: (n: number) => string;
    height?: number;
}) {
    const { ref, show, hide, node } = useTip();
    const [active, setActive] = useState<number | null>(null);

    const W = 600;
    const padL = 8, padR = 8, padT = 12, padB = 22;
    const max = Math.max(...data.map((d) => d.value), 0) || 1;
    const x = (i: number) => padL + (data.length === 1 ? (W - padL - padR) / 2 : (i / (data.length - 1)) * (W - padL - padR));
    const y = (v: number) => padT + (1 - v / max) * (height - padT - padB);

    const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
    const area = `${path} L${x(data.length - 1).toFixed(1)},${height - padB} L${x(0).toFixed(1)},${height - padB} Z`;
    const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

    return (
        <div ref={ref} className="relative">
            <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} role="img" aria-label="Trend">
                {[0.5, 1].map((f) => (
                    <line key={f} x1={padL} x2={W - padR} y1={padT + (1 - f) * (height - padT - padB)} y2={padT + (1 - f) * (height - padT - padB)} stroke={GRID} strokeWidth={1} />
                ))}
                <line x1={padL} x2={W - padR} y1={height - padB} y2={height - padB} stroke={GRID} strokeWidth={1} />
                <path d={area} fill={color} opacity={0.08} />
                <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {data.map((d, i) => (
                    <text key={d.label} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill={MUTED}>
                        {i % 2 === 0 || data.length <= 6 ? d.label : ''}
                    </text>
                ))}
                {active !== null && (
                    <line x1={x(active)} x2={x(active)} y1={padT} y2={height - padB} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" />
                )}
                {/* Direct label on the peak only, never a number on every point. */}
                {data[peak].value > 0 && (
                    <text x={x(peak)} y={y(data[peak].value) - 8} textAnchor={peak > data.length - 3 ? 'end' : 'middle'} fontSize={10} fill="rgb(var(--on-surface))" fontWeight={600}>
                        {formatValue(data[peak].value)}
                    </text>
                )}
                {data.map((d, i) => (
                    <g key={`m-${d.label}`}>
                        {(active === i || i === peak && d.value > 0) && (
                            <circle cx={x(i)} cy={y(d.value)} r={4} fill={color} stroke="rgb(var(--surface-container-lowest))" strokeWidth={2} />
                        )}
                        {/* Wide transparent hit target, far bigger than the mark. */}
                        <rect
                            x={x(i) - (W - padL - padR) / (data.length * 2)}
                            y={0}
                            width={(W - padL - padR) / data.length}
                            height={height}
                            fill="transparent"
                            tabIndex={0}
                            onMouseEnter={(e) => { setActive(i); show(e, d.tipTitle, d.tipLines); }}
                            onMouseLeave={() => { setActive(null); hide(); }}
                            onFocus={(e) => { setActive(i); show(e, d.tipTitle, d.tipLines); }}
                            onBlur={() => { setActive(null); hide(); }}
                            aria-label={`${d.tipTitle}: ${d.tipLines.join(', ')}`}
                        />
                    </g>
                ))}
            </svg>
            {node}
        </div>
    );
}

/* ─── Horizontal bars (by project, by agent, funnel) ──────── */

export interface BarRow { key: string; label: string; value: number; valueLabel: string; sub?: string }

export function HBars({
    rows, color = SERIES.one, empty,
}: {
    rows: BarRow[];
    color?: string;
    empty?: string;
}) {
    const max = Math.max(...rows.map((r) => r.value), 0);
    if (rows.length === 0) {
        return empty ? <p className="text-sm text-on-surface-variant/70 py-4">{empty}</p> : null;
    }
    return (
        <ul className="space-y-3">
            {rows.map((r) => (
                <li key={r.key}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-sm text-on-surface truncate">{r.label}</span>
                        <span className="text-sm font-semibold tabular-nums text-on-surface flex-shrink-0">{r.valueLabel}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-high overflow-hidden" title={r.sub}>
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${max > 0 ? Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100) : 0}%`, background: color }}
                        />
                    </div>
                    {r.sub && <p className="text-[11px] text-on-surface-variant/70 mt-0.5">{r.sub}</p>}
                </li>
            ))}
        </ul>
    );
}

/* ─── Progress against a target ───────────────────────────── */

export function TargetBar({
    label, achieved, target, achievedLabel, targetLabel, percentLabel,
}: {
    label: string;
    achieved: number;
    target: number;
    achievedLabel: string;
    targetLabel: string;
    percentLabel: string;
}) {
    const pct = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
    return (
        <li>
            <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-sm text-on-surface truncate">{label}</span>
                <span className="text-sm font-semibold tabular-nums text-on-surface flex-shrink-0">{percentLabel}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SERIES.one }} />
            </div>
            <p className="text-[11px] text-on-surface-variant/70 mt-0.5 tabular-nums">
                {achievedLabel} / {targetLabel}
            </p>
        </li>
    );
}

/* ─── Stacked bar (inventory status) ──────────────────────── */

export interface StackSegment { key: string; label: string; count: number; valueLabel: string; color: string }

export function StackedBar({ segments, total }: { segments: StackSegment[]; total: number }) {
    const { ref, show, hide, node } = useTip();
    return (
        <div ref={ref} className="relative">
            {/* 2px surface gaps between fills, so adjacent segments never touch. */}
            <div className="flex h-6 gap-0.5 rounded-md overflow-hidden" role="img" aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(', ')}>
                {segments.filter((s) => s.count > 0).map((s) => (
                    <button
                        type="button"
                        key={s.key}
                        className="h-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:opacity-80"
                        style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%`, background: s.color }}
                        onMouseEnter={(e) => show(e, s.label, [`${s.count}`, s.valueLabel])}
                        onMouseLeave={hide}
                        onFocus={(e) => show(e, s.label, [`${s.count}`, s.valueLabel])}
                        onBlur={hide}
                        aria-label={`${s.label}: ${s.count}, ${s.valueLabel}`}
                    />
                ))}
                {total === 0 && <div className="h-full w-full bg-surface-container-high" />}
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-3">
                {segments.map((s) => (
                    <li key={s.key} className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} aria-hidden />
                            <span className="text-xs text-on-surface-variant truncate">{s.label}</span>
                        </div>
                        <p className="text-xl font-semibold text-on-surface tabular-nums mt-0.5">{s.count}</p>
                        <p className="text-[11px] text-on-surface-variant/70 tabular-nums truncate">{s.valueLabel}</p>
                    </li>
                ))}
            </ul>
            {node}
        </div>
    );
}

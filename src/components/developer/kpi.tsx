'use client';

import type { ReactNode } from 'react';

/**
 * The developer dashboard's building blocks, shared so every screen that reports
 * on lots (dashboard, projects, a project, stock) reads the same way: a row of
 * figures in one bordered strip, and titled sections for anything longer.
 */

const COLS: Record<number, string> = {
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
};
/** The same column counts at every width, for a strip inside a card. */
const FIXED_COLS: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
};

/** Figures side by side in one strip, separated by hairlines. */
export function KpiGrid({
    children, cols = 4, fixed = false, className = '',
}: { children: ReactNode; cols?: 2 | 3 | 4 | 5; fixed?: boolean; className?: string }) {
    return (
        <div className={`grid ${fixed ? FIXED_COLS[cols] : `grid-cols-2 ${COLS[cols]}`} gap-px bg-outline-variant/20 border border-outline-variant/20 rounded-xl overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

/** One figure: its label, the number, and an optional line under it (a value, a change). */
export function Kpi({
    label, value, sub, delta, tone, compact = false,
}: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    delta?: ReactNode;
    /** Colour for the number when it carries meaning (overdue, sold...). */
    tone?: string;
    /** Smaller, for a strip inside a card. */
    compact?: boolean;
}) {
    return (
        <div className={`${compact ? 'px-3 py-2.5' : 'p-4'} min-w-0 bg-surface-container-lowest`}>
            <p className={`text-xs text-on-surface-variant truncate ${compact ? 'mb-0.5' : 'mb-1.5'}`}>{label}</p>
            <p className={`${compact ? 'text-base' : 'text-xl'} font-semibold tabular-nums truncate ${tone ?? 'text-on-surface'}`}>{value}</p>
            {!compact && (
                <div className="mt-1 flex items-center gap-2 min-h-[16px]">
                    {delta}
                    {sub && <span className="text-[11px] text-on-surface-variant/70 tabular-nums truncate">{sub}</span>}
                </div>
            )}
        </div>
    );
}

/** A titled block of the dashboard: a small uppercase heading with its icon, then the content. */
export function Section({
    title, icon, children, className = '', action,
}: {
    title: string;
    /** A Material Symbols name, as on the dashboard. */
    icon: string;
    children: ReactNode;
    className?: string;
    action?: ReactNode;
}) {
    return (
        <section className={`border border-outline-variant/20 rounded-xl bg-surface-container-lowest/50 p-5 min-w-0 ${className}`}>
            <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-on-surface-variant text-base">{icon}</span>
                <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{title}</h2>
                {action && <div className="ms-auto">{action}</div>}
            </div>
            {children}
        </section>
    );
}

/** The dashboard's thin progress bar. */
export function Meter({ percent, label }: { percent: number; label: string }) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    return (
        <div
            className="h-1.5 rounded-full bg-surface-container-high overflow-hidden"
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
        >
            <div className="h-full bg-secondary transition-[width] duration-300" style={{ width: `${value}%` }} />
        </div>
    );
}

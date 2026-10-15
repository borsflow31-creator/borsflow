'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { inputClass } from '@/components/realestate/ui';
import { useI18n } from '@/i18n/I18nProvider';

export interface CollectionTarget {
    id: string;
    lotNumber: string;
    status: string;
    program: { id: string; name: string };
    buyerLead: { id: string; firstName: string; lastName: string | null } | null;
    outstanding: number;
    overdue: number;
}

type Load = { state: 'idle' | 'loading' | 'ready' | 'error'; targets: CollectionTarget[] };

/**
 * Finds the sold unit to collect from by the buyer's name, email or phone, the
 * unit number or the project, so nobody has to know the call number to take a
 * payment. Searches on the server, a newer search cancels an older one, and the
 * list shows what is owed so the right unit is obvious before it is opened.
 */
export default function CollectionTargetPicker({
    workspaceId, currency, onPick,
}: {
    workspaceId: string;
    currency: string;
    onPick: (target: CollectionTarget) => void;
}) {
    const { t, formatCurrency } = useI18n();
    const id = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [load, setLoad] = useState<Load>({ state: 'idle', targets: [] });
    const [attempt, setAttempt] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setLoad((prev) => ({ state: 'loading', targets: prev.targets }));
            const params = new URLSearchParams({ workspaceId });
            if (query.trim()) params.set('q', query.trim());
            fetch(`/api/developer/collections/search?${params}`, { signal: controller.signal })
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
                .then((d: { targets?: CollectionTarget[] }) => setLoad({ state: 'ready', targets: d.targets ?? [] }))
                .catch((e: unknown) => {
                    if ((e as { name?: string }).name !== 'AbortError') setLoad({ state: 'error', targets: [] });
                });
        }, query ? 250 : 0);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [open, workspaceId, query, attempt]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const options = load.targets;

    const pick = (target: CollectionTarget) => {
        onPick(target);
        setQuery('');
        setOpen(false);
        setActive(0);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && options[active]) pick(options[active]);
        } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
        }
    };

    const listId = `${id}-list`;
    const buyerName = (target: CollectionTarget) =>
        target.buyerLead ? `${target.buyerLead.firstName} ${target.buyerLead.lastName ?? ''}`.trim() : '–';

    return (
        <div ref={rootRef} className="relative">
            <label htmlFor={`${id}-input`} className="block body-sm text-on-surface-variant mb-2">
                {t('developerSales.payments.searchLabel')}
            </label>
            <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" aria-hidden="true" />
                <input
                    id={`${id}-input`}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={open && options[active] ? `${id}-opt-${options[active].id}` : undefined}
                    className={`${inputClass} ps-9`}
                    value={query}
                    maxLength={60}
                    placeholder={t('developerSales.payments.searchPlaceholder')}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setActive(0);
                        setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                />
            </div>

            {open && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-outline-variant bg-surface-container shadow-lg">
                    {load.state === 'error' ? (
                        <div className="flex items-center justify-between gap-3 px-3 py-3 body-sm" role="alert">
                            <span className="text-error">{t('developerSales.payments.searchError')}</span>
                            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="text-secondary font-medium hover:underline">
                                {t('developerSales.payments.retry')}
                            </button>
                        </div>
                    ) : load.state !== 'ready' && options.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-3 body-sm text-on-surface-variant" role="status">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            {t('developerSales.payments.loading')}
                        </div>
                    ) : options.length === 0 ? (
                        <p className="px-3 py-3 body-sm text-on-surface-variant" role="status">
                            {query.trim() ? t('developerSales.payments.searchNoMatch') : t('developerSales.payments.searchEmpty')}
                        </p>
                    ) : (
                        <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
                            {options.map((target, index) => (
                                <li
                                    key={target.id}
                                    id={`${id}-opt-${target.id}`}
                                    role="option"
                                    aria-selected={index === active}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pick(target)}
                                    onMouseEnter={() => setActive(index)}
                                    className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer body-sm ${
                                        index === active ? 'bg-surface-container-high' : ''
                                    }`}
                                >
                                    <span className="min-w-0">
                                        <strong className="font-medium text-on-surface">{buyerName(target)}</strong>
                                        <span className="text-on-surface-variant"> · {target.program.name} · {target.lotNumber}</span>
                                    </span>
                                    <span className={`shrink-0 tabular-nums ${target.overdue > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                                        {target.overdue > 0
                                            ? t('developerSales.payments.overdueShort', { amount: formatCurrency(target.overdue, currency) })
                                            : target.outstanding > 0
                                                ? t('developerSales.payments.outstandingShort', { amount: formatCurrency(target.outstanding, currency) })
                                                : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

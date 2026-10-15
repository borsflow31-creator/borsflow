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
    buyerLead: { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null } | null;
    outstanding: number;
    overdue: number;
}

/** One buyer and every sold unit they are paying for. */
export interface CollectionClient {
    buyer: NonNullable<CollectionTarget['buyerLead']>;
    units: CollectionTarget[];
    outstanding: number;
    overdue: number;
}

type Load = { state: 'idle' | 'loading' | 'ready' | 'error'; clients: CollectionClient[] };

export function clientName(buyer: { firstName: string; lastName: string | null }): string {
    return `${buyer.firstName} ${buyer.lastName ?? ''}`.trim();
}

/**
 * Finds the client to collect from by name, phone, email, unit number or project,
 * so nobody has to know a call number to take a payment. One line per buyer, with
 * what they still owe, so the right person is obvious before they are opened.
 * Searches on the server; a newer search cancels an older one.
 */
export default function CollectionTargetPicker({
    workspaceId, currency, onPick,
}: {
    workspaceId: string;
    currency: string;
    onPick: (client: CollectionClient) => void;
}) {
    const { t, formatCurrency } = useI18n();
    const id = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [load, setLoad] = useState<Load>({ state: 'idle', clients: [] });
    const [attempt, setAttempt] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setLoad((prev) => ({ state: 'loading', clients: prev.clients }));
            const params = new URLSearchParams({ workspaceId });
            if (query.trim()) params.set('q', query.trim());
            fetch(`/api/developer/collections/search?${params}`, { signal: controller.signal })
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
                .then((d: { clients?: CollectionClient[] }) => setLoad({ state: 'ready', clients: d.clients ?? [] }))
                .catch((e: unknown) => {
                    if ((e as { name?: string }).name !== 'AbortError') setLoad({ state: 'error', clients: [] });
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

    const options = load.clients;

    const pick = (client: CollectionClient) => {
        onPick(client);
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

    return (
        <div ref={rootRef} className="relative">
            <label htmlFor={`${id}-input`} className="block text-sm font-medium text-on-surface mb-2">
                {t('developerSales.payments.clientSearchLabel')}
            </label>
            <div className="relative">
                <Search className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" aria-hidden="true" />
                <input
                    id={`${id}-input`}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={open && options[active] ? `${id}-opt-${options[active].buyer.id}` : undefined}
                    className={`${inputClass} !py-3 !text-base ps-12`}
                    value={query}
                    maxLength={60}
                    placeholder={t('developerSales.payments.clientSearchPlaceholder')}
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
                        <div className="flex items-center justify-between gap-3 px-4 py-3 body-sm" role="alert">
                            <span className="text-error">{t('developerSales.payments.searchError')}</span>
                            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="text-secondary font-medium hover:underline">
                                {t('developerSales.payments.retry')}
                            </button>
                        </div>
                    ) : load.state !== 'ready' && options.length === 0 ? (
                        <div className="flex items-center gap-2 px-4 py-3 body-sm text-on-surface-variant" role="status">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            {t('developerSales.payments.loading')}
                        </div>
                    ) : options.length === 0 ? (
                        <p className="px-4 py-3 body-sm text-on-surface-variant" role="status">
                            {query.trim() ? t('developerSales.payments.clientNoMatch') : t('developerSales.payments.clientEmpty')}
                        </p>
                    ) : (
                        <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto py-1 divide-y divide-outline-variant/15">
                            {options.map((client, index) => {
                                const contact = [client.buyer.phone, client.buyer.email].filter(Boolean).join(' · ');
                                return (
                                    <li
                                        key={client.buyer.id}
                                        id={`${id}-opt-${client.buyer.id}`}
                                        role="option"
                                        aria-selected={index === active}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => pick(client)}
                                        onMouseEnter={() => setActive(index)}
                                        className={`flex items-center justify-between gap-4 px-4 py-2.5 cursor-pointer ${
                                            index === active ? 'bg-surface-container-high' : ''
                                        }`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium text-on-surface truncate">{clientName(client.buyer)}</span>
                                            <span className="block text-xs text-on-surface-variant truncate">
                                                {contact || client.units.map((u) => `${u.program.name} · ${u.lotNumber}`).join(', ')}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-end tabular-nums">
                                            <span className="block text-sm text-on-surface">
                                                {client.outstanding > 0
                                                    ? t('developerSales.payments.leftToPayShort', { amount: formatCurrency(client.outstanding, currency) })
                                                    : t('developerSales.payments.upToDate')}
                                            </span>
                                            <span className="block text-xs text-on-surface-variant">
                                                {t('developerSales.payments.unitsCount', { count: client.units.length })}
                                                {client.overdue > 0 && (
                                                    <span className="text-error">
                                                        {' · '}
                                                        {t('developerSales.payments.overdueShort', { amount: formatCurrency(client.overdue, currency) })}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { inputClass } from '@/components/realestate/ui';
import { useI18n } from '@/i18n/I18nProvider';
import { MAX_INTERESTED_LOTS } from '@/lib/crm/contact-match';
import type { PickedLot } from './lead-autofill';

type Load = { state: 'idle' | 'loading' | 'ready' | 'error'; lots: PickedLot[] };

/**
 * Picks the units a buyer is interested in from the chosen programme's
 * available stock, so what they want is a real unit rather than a typed
 * description of one. Searches on the server (number, typology, building) so a
 * large programme is never loaded whole; a newer search cancels the older one so
 * a slow answer cannot overwrite a fresh one.
 *
 * The menu sits in the form's flow rather than floating, so the modal's scroll
 * area cannot clip it.
 */
export default function LotPicker({
    workspaceId, programId, selected, onChange, currency,
}: {
    workspaceId: string;
    programId: string;
    selected: PickedLot[];
    onChange: (lots: PickedLot[]) => void;
    currency: string;
}) {
    const { t, formatCurrency } = useI18n();
    const id = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [load, setLoad] = useState<Load>({ state: 'idle', lots: [] });
    const [attempt, setAttempt] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open || !programId) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setLoad((prev) => ({ state: 'loading', lots: prev.lots }));
            const params = new URLSearchParams({ workspaceId, programId });
            if (query.trim()) params.set('q', query.trim());
            fetch(`/api/developer/lots/selectable?${params}`, { signal: controller.signal })
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
                .then((d: { lots?: PickedLot[] }) => setLoad({ state: 'ready', lots: d.lots ?? [] }))
                .catch((e: unknown) => {
                    if ((e as { name?: string }).name !== 'AbortError') setLoad({ state: 'error', lots: [] });
                });
        }, query ? 250 : 0);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [open, programId, workspaceId, query, attempt]);

    // A new programme is a new stock list.
    useEffect(() => {
        setLoad({ state: 'idle', lots: [] });
        setQuery('');
    }, [programId]);

    // Close when focus or a click goes elsewhere.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const chosen = new Set(selected.map((l) => l.id));
    const options = load.lots.filter((l) => !chosen.has(l.id));
    const full = selected.length >= MAX_INTERESTED_LOTS;

    const describe = useCallback((lot: PickedLot) => [
        lot.typology || null,
        lot.building?.name || null,
        lot.floor === 0 ? t('developerCrm.lead.groundFloor') : t('developerCrm.lead.floorShort', { floor: lot.floor }),
        lot.surfaceArea > 0 ? `${lot.surfaceArea} m²` : null,
    ].filter(Boolean).join(' · '), [t]);

    const pick = (lot: PickedLot) => {
        if (full) return;
        onChange([...selected, lot]);
        setQuery('');
        setActive(0);
        inputRef.current?.focus();
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
            // Enter in this box picks a unit; it must never submit the lead form.
            e.preventDefault();
            if (open && options[active]) pick(options[active]);
        } else if (e.key === 'Escape') {
            if (open) {
                e.stopPropagation();
                setOpen(false);
            }
        } else if (e.key === 'Backspace' && !query && selected.length > 0) {
            onChange(selected.slice(0, -1));
        }
    };

    const listId = `${id}-list`;
    const disabled = !programId;

    return (
        <div ref={rootRef}>
            <label htmlFor={`${id}-input`} className="block body-sm text-on-surface-variant mb-2">
                {t('developerCrm.lead.units')}
            </label>

            {selected.length > 0 && (
                <ul className="flex flex-wrap gap-2 mb-2" aria-label={t('developerCrm.lead.units')}>
                    {selected.map((lot) => (
                        <li
                            key={lot.id}
                            className="inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-primary/10 text-on-surface body-sm"
                        >
                            <span>
                                <strong className="font-medium">{lot.lotNumber}</strong>
                                {lot.typology && <span className="text-on-surface-variant"> · {lot.typology}</span>}
                                {lot.totalPrice > 0 && (
                                    <span className="text-on-surface-variant tabular-nums"> · {formatCurrency(lot.totalPrice, currency)}</span>
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={() => onChange(selected.filter((l) => l.id !== lot.id))}
                                className="w-6 h-6 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                                aria-label={t('developerCrm.lead.removeUnitAria', { lot: lot.lotNumber })}
                            >
                                <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <input
                id={`${id}-input`}
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={open && !disabled}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && options[active] ? `${id}-opt-${options[active].id}` : undefined}
                className={inputClass}
                value={query}
                disabled={disabled || full}
                maxLength={60}
                placeholder={
                    disabled
                        ? t('developerCrm.lead.unitsPickProjectFirst')
                        : full
                            ? t('developerCrm.lead.unitsMax', { count: MAX_INTERESTED_LOTS })
                            : t('developerCrm.lead.unitsSearch')
                }
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                    setOpen(true);
                }}
                onKeyDown={onKeyDown}
            />

            {open && !disabled && !full && (
                <div className="mt-1 rounded-lg border border-outline-variant bg-surface-container shadow-sm">
                    {load.state === 'error' ? (
                        <div className="flex items-center justify-between gap-3 px-3 py-3 body-sm" role="alert">
                            <span className="text-error">{t('developerCrm.lead.unitsError')}</span>
                            <button
                                type="button"
                                onClick={() => setAttempt((n) => n + 1)}
                                className="text-secondary font-medium hover:underline"
                            >
                                {t('developerCrm.lead.retry')}
                            </button>
                        </div>
                    ) : load.state !== 'ready' && options.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-3 body-sm text-on-surface-variant" role="status">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            {t('developerCrm.lead.loading')}
                        </div>
                    ) : options.length === 0 ? (
                        <p className="px-3 py-3 body-sm text-on-surface-variant" role="status">
                            {query.trim() ? t('developerCrm.lead.unitsNoMatch') : t('developerCrm.lead.unitsEmpty')}
                        </p>
                    ) : (
                        <ul id={listId} role="listbox" aria-multiselectable="true" className="max-h-60 overflow-y-auto py-1">
                            {options.map((lot, index) => (
                                <li
                                    key={lot.id}
                                    id={`${id}-opt-${lot.id}`}
                                    role="option"
                                    aria-selected={index === active}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pick(lot)}
                                    onMouseEnter={() => setActive(index)}
                                    className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer body-sm ${
                                        index === active ? 'bg-surface-container-high' : ''
                                    }`}
                                >
                                    <span className="min-w-0">
                                        <strong className="font-medium text-on-surface">{lot.lotNumber}</strong>
                                        <span className="text-on-surface-variant"> · {describe(lot)}</span>
                                    </span>
                                    {lot.totalPrice > 0 && (
                                        <span className="shrink-0 tabular-nums text-on-surface">
                                            {formatCurrency(lot.totalPrice, currency)}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

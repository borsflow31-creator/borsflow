'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { inputClass } from './ui';

export interface PickedProperty {
    id: string;
    title: string;
    reference: string;
    city: string;
}

/** Search the workspace's properties and pick one. */
export default function PropertyPicker({
    workspaceId,
    value,
    onChange,
    placeholder,
    onMarketOnly = false,
}: {
    workspaceId: string;
    value: PickedProperty | null;
    onChange: (property: PickedProperty | null) => void;
    placeholder: string;
    /** Offers and viewings only make sense on a property that is on the market. */
    onMarketOnly?: boolean;
}) {
    const { t } = useI18n();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PickedProperty[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const status = onMarketOnly ? '&status=live,under_offer' : '';
                const res = await fetch(`/api/properties?workspaceId=${workspaceId}&q=${encodeURIComponent(query)}&limit=20${status}`);
                const data = res.ok ? await res.json() : { properties: [] };
                setResults(data.properties ?? []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, open, workspaceId, onMarketOnly]);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    if (value) {
        return (
            <div className={`${inputClass} flex items-center justify-between gap-2`}>
                <span className="truncate">
                    {value.title}
                    <span className="text-on-surface-variant"> · {value.reference}</span>
                </span>
                <button type="button" onClick={() => onChange(null)} className="text-on-surface-variant hover:text-error" aria-label={t('common.remove')}>
                    ×
                </button>
            </div>
        );
    }

    return (
        <div ref={boxRef} className="relative">
            <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className={inputClass}
                autoComplete="off"
            />
            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-surface rounded-lg shadow-xl border border-outline-variant/10 max-h-60 overflow-y-auto">
                    {loading && <p className="body-sm text-on-surface-variant p-3">{t('common.loading')}</p>}
                    {!loading && results.length === 0 && <p className="body-sm text-on-surface-variant p-3">—</p>}
                    {results.map(property => (
                        <button
                            key={property.id}
                            type="button"
                            onClick={(e) => { e.preventDefault(); /* see ContactPicker: inside a <label>, the default click would hit the clear button */ onChange(property); setOpen(false); setQuery(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors"
                        >
                            <span className="body-md text-on-surface">{property.title}</span>
                            <span className="block body-xs text-on-surface-variant">{property.reference} · {property.city}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

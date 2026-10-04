'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { inputClass, contactName } from './ui';

export interface PickedContact {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
}

/**
 * Search the workspace's contacts and pick one: a buyer for an interest or an
 * offer, a vendor for a property or a mandate. Reuses /api/leads/search, the same
 * endpoint the quote and invoice contact picker uses.
 */
export default function ContactPicker({
    workspaceId,
    value,
    onChange,
    placeholder,
    allowClear = true,
}: {
    workspaceId: string;
    value: PickedContact | null;
    onChange: (contact: PickedContact | null) => void;
    placeholder: string;
    allowClear?: boolean;
}) {
    const { t } = useI18n();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<PickedContact[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    // 300ms debounce, like the product picker.
    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/leads/search?workspaceId=${workspaceId}&q=${encodeURIComponent(query)}`);
                const data = res.ok ? await res.json() : { leads: [] };
                setResults(data.leads ?? []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, open, workspaceId]);

    // Click outside closes the list.
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
                    {contactName(value)}
                    {value.email ? <span className="text-on-surface-variant"> · {value.email}</span> : null}
                </span>
                {allowClear && (
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="text-on-surface-variant hover:text-error"
                        aria-label={t('common.remove')}
                    >
                        ×
                    </button>
                )}
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
                    {results.map(contact => (
                        <button
                            key={contact.id}
                            type="button"
                            onClick={() => { onChange(contact); setOpen(false); setQuery(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors"
                        >
                            <span className="body-md text-on-surface">{contactName(contact)}</span>
                            {contact.email && <span className="block body-xs text-on-surface-variant">{contact.email}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { cachedJson } from '@/lib/client-cache';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Small shared pieces for the real-estate screens, following the markup the
 * existing CRM modals use (PipelineModal) so the new screens look like the old
 * ones: surface cards, `premium-input` fields, the same overlay.
 */

export const inputClass = 'premium-input w-full px-4 py-2.5 text-sm transition-all';
export const primaryButton =
    'px-4 py-2 bg-primary text-on-primary rounded text-sm hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const secondaryButton =
    'px-4 py-2 bg-surface-container-high rounded text-sm text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50';
export const dangerButton =
    'px-4 py-2 bg-error-container text-error rounded text-sm hover:opacity-90 transition-colors disabled:opacity-50';

export function Modal({
    title,
    onClose,
    children,
    wide = false,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
}) {
    const { t } = useI18n();

    // Escape closes, like every other dialog.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={title}>
            <div className={`bg-surface rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
                <div className="p-6">
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <h2 className="headline-lg text-on-surface">{title}</h2>
                        <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors" aria-label={t('common.cancel')}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
    return (
        <label className="block">
            <span className="block body-sm text-on-surface-variant mb-2">{label}</span>
            {children}
            {hint && <span className="block body-xs text-on-surface-variant mt-1">{hint}</span>}
        </label>
    );
}

export function SectionTitle({ children }: { children: ReactNode }) {
    return <h3 className="title-md text-on-surface mb-3">{children}</h3>;
}

const TONES: Record<string, string> = {
    neutral: 'bg-surface-container-highest text-on-surface-variant',
    good: 'bg-emerald-100 text-emerald-800',
    info: 'bg-blue-100 text-blue-800',
    warn: 'bg-yellow-100 text-yellow-800',
    bad: 'bg-red-100 text-red-800',
};

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
    return <span className={`body-xs px-2 py-1 rounded whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}

/** Which tone each lifecycle value reads as. Unknown values fall back to neutral. */
export const STATUS_TONE: Record<string, keyof typeof TONES> = {
    // property
    prospect: 'neutral', valuation: 'info', mandate: 'info', live: 'good', under_offer: 'warn', sold: 'good', withdrawn: 'neutral', expired: 'bad',
    // mandate
    draft: 'neutral', active: 'good', terminated: 'bad', completed: 'good',
    // interest
    won: 'good', lost: 'bad', on_hold: 'warn',
    // offer
    pending: 'warn', accepted: 'good', rejected: 'bad',
    // viewing
    scheduled: 'info', in_progress: 'info', cancelled: 'neutral', no_show: 'bad',
};

export interface WorkspaceInfo {
    name: string;
    currency: string;
    /** The owner and every member: who a record can be assigned to. */
    agents: { id: string; name: string }[];
}

/** The workspace's name, currency and agents, cached across navigations. */
export function useWorkspaceInfo(workspaceId: string): WorkspaceInfo {
    const [info, setInfo] = useState<WorkspaceInfo>({ name: '', currency: 'USD', agents: [] });

    useEffect(() => {
        if (!workspaceId) return;
        let cancelled = false;
        cachedJson(`/api/workspaces/${workspaceId}`)
            .then(data => {
                if (cancelled || !data?.workspace) return;
                const w = data.workspace;
                const seen = new Map<string, string>();
                const add = (u: { id: string; name?: string | null; email?: string | null } | undefined) => {
                    if (u) seen.set(u.id, u.name || u.email || u.id);
                };
                add(w.owner);
                for (const m of w.members ?? []) add(m.user);
                setInfo({
                    name: w.name ?? '',
                    currency: w.currency || 'USD',
                    agents: Array.from(seen, ([id, name]) => ({ id, name })),
                });
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [workspaceId]);

    return info;
}

/** Reads the API's { error } message, falling back to a caller-supplied default. */
export async function errorFrom(response: Response, fallback: string): Promise<string> {
    try {
        const data = await response.json();
        return typeof data?.error === 'string' ? data.error : fallback;
    } catch {
        return fallback;
    }
}

/** A buyer's or vendor's display name. */
export function contactName(c: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
    return `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim();
}

export function Spinner() {
    return <div className="skeleton w-full h-24 rounded" />;
}

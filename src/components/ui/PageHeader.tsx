'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import type { Messages } from '@/i18n/messages/en';

/** A page with a "How this page works" guide, keyed by its entry in developerGuide.pages. */
export type GuideId = keyof Messages['developerGuide']['pages'];

const storageKey = (id: GuideId) => `page-guide-hidden:${id}`;

function readHidden(id: GuideId): boolean {
    try {
        return localStorage.getItem(storageKey(id)) === '1';
    } catch {
        return false;
    }
}

function writeHidden(id: GuideId, hidden: boolean) {
    try {
        if (hidden) localStorage.setItem(storageKey(id), '1');
        else localStorage.removeItem(storageKey(id));
    } catch {
        // Private windows and blocked storage: the guide just shows again next time.
    }
}

/**
 * Whether a page's guide is open. Open the first time someone visits, closed
 * after they dismiss it, and the choice is remembered per browser. Undefined
 * until mounted so the server render and the first client render agree.
 */
function useGuideOpen(id: GuideId | undefined) {
    const [open, setOpen] = useState<boolean | undefined>(undefined);
    useEffect(() => {
        if (id) setOpen(!readHidden(id));
    }, [id]);
    const set = (next: boolean) => {
        setOpen(next);
        if (id) writeHidden(id, !next);
    };
    return [open, set] as const;
}

/** The numbered three-step explanation of what a page is for. */
export function PageGuide({ id, onClose }: { id: GuideId; onClose?: () => void }) {
    const { t } = useI18n();
    const steps = [1, 2, 3].map((n) => t(`developerGuide.pages.${id}.step${n}` as MessageKey));
    return (
        <section
            aria-label={t('developerGuide.howItWorks')}
            className="relative rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5"
        >
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    <HelpCircle className="w-4 h-4 text-primary" />
                    {t('developerGuide.howItWorks')}
                </h2>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface px-2 py-1 rounded hover:bg-surface-container-high transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                        {t('developerGuide.hideGuide')}
                    </button>
                )}
            </div>
            <ol className="grid gap-3 sm:grid-cols-3">
                {steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-on-surface-variant">
                        <span className="flex-none w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-semibold flex items-center justify-center">
                            {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

/**
 * The header every developer page shares: icon, title, a one-line description
 * of what the page is for, the page's actions, and its "How this page works"
 * guide, which can be hidden and brought back with the help button.
 */
export default function PageHeader({
    icon: Icon,
    title,
    subtitle,
    actions,
    guide,
}: {
    icon: LucideIcon;
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    guide?: GuideId;
}) {
    const { t } = useI18n();
    const [guideOpen, setGuideOpen] = useGuideOpen(guide);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-primary/10 text-primary rounded-lg">
                            <Icon className="w-6 h-6" />
                        </span>
                        <h1 className="text-2xl font-bold text-on-surface">{title}</h1>
                        {guide && guideOpen === false && (
                            <button
                                type="button"
                                onClick={() => setGuideOpen(true)}
                                className="p-1.5 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                                title={t('developerGuide.showGuide')}
                                aria-label={t('developerGuide.showGuide')}
                            >
                                <HelpCircle className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    {subtitle && <p className="text-sm text-on-surface-variant mt-1">{subtitle}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {guide && guideOpen && <PageGuide id={guide} onClose={() => setGuideOpen(false)} />}
        </div>
    );
}

/**
 * The guide on its own, for a page whose header is custom (a project's profile
 * card): shows the guide, or a small link to bring it back once hidden.
 */
export function StandaloneGuide({ id }: { id: GuideId }) {
    const { t } = useI18n();
    const [open, setOpen] = useGuideOpen(id);
    if (open === undefined) return null;
    if (open) return <PageGuide id={id} onClose={() => setOpen(false)} />;
    return (
        <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors"
        >
            <HelpCircle className="w-4 h-4" />
            {t('developerGuide.showGuide')}
        </button>
    );
}

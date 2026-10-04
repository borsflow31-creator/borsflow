'use client';

import { Suspense, useState } from 'react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import { useI18n } from '@/i18n/I18nProvider';
import ViewingsList, { ViewingFormModal } from '@/components/realestate/ViewingsPanel';
import { useWorkspaceInfo } from '@/components/realestate/ui';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';

const VIEWS = ['upcoming', 'needs_feedback', 'past'] as const;

/** Viewings across the agency: what is coming, what still needs feedback, what is done. */
function ViewingsPageInner() {
    const { t } = useI18n();
    const { workspaceId, ready } = useWorkspaceParam();
    const info = useWorkspaceInfo(workspaceId);
    const [view, setView] = useState<(typeof VIEWS)[number]>('upcoming');
    const [booking, setBooking] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <NoWorkspace />;

    const labels = { upcoming: t('realEstate.viewings.upcoming'), needs_feedback: t('realEstate.viewings.needsFeedback'), past: t('realEstate.viewings.past') };

    return (
        <AppShell
            workspace={{ id: workspaceId, name: info.name || t('crm.page.workspaceFallback') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('realEstate.nav.viewings'), href: `/viewings?workspace=${workspaceId}` },
            ]}
        >
            <div className="p-4 sm:p-6 max-w-5xl mx-auto">
                <div className="mb-6">
                    <h1 className="display-md text-on-surface">{t('realEstate.viewings.title')}</h1>
                    <p className="body-md text-on-surface-variant">{t('realEstate.viewings.subtitle')}</p>
                </div>
                <div className="mb-4 flex flex-wrap gap-2" role="tablist">
                    {VIEWS.map(v => (
                        <button
                            key={v}
                            role="tab"
                            aria-selected={view === v}
                            onClick={() => setView(v)}
                            className={`px-4 py-2 rounded-lg body-md transition-colors ${view === v ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
                        >
                            {labels[v]}
                        </button>
                    ))}
                </div>
                <ViewingsList
                    key={view}
                    workspaceId={workspaceId}
                    when={view}
                    canWrite
                    refreshKey={refreshKey}
                    onBook={() => setBooking(true)}
                />
                {booking && (
                    <ViewingFormModal
                        workspaceId={workspaceId}
                        onClose={() => setBooking(false)}
                        onSaved={() => { setBooking(false); setRefreshKey(k => k + 1); }}
                    />
                )}
            </div>
        </AppShell>
    );
}

export default function ViewingsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <ViewingsPageInner />
        </Suspense>
    );
}

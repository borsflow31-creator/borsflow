'use client';

import { Suspense, useState } from 'react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import OffersPanel from '@/components/realestate/OffersPanel';
import { useWorkspaceInfo } from '@/components/realestate/ui';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { OFFER_STATUSES } from '@/lib/crm/lifecycle';

/** Every offer in the agency, filterable by status. Recording one happens on its property. */
function OffersPageInner() {
    const { t } = useI18n();
    const { workspaceId, ready } = useWorkspaceParam();
    const info = useWorkspaceInfo(workspaceId);
    const [status, setStatus] = useState<string>('pending');
    const [canWrite] = useState(true);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <NoWorkspace />;

    const filters = ['', ...OFFER_STATUSES];

    return (
        <AppShell
            workspace={{ id: workspaceId, name: info.name || t('crm.page.workspaceFallback') }}
            currentPage={undefined}
            breadcrumbs={[
                { label: t('nav.dashboard'), href: '/dashboard' },
                { label: t('realEstate.nav.offers'), href: `/offers?workspace=${workspaceId}` },
            ]}
        >
            <div className="p-4 sm:p-6 max-w-5xl mx-auto">
                <div className="mb-6">
                    <h1 className="display-md text-on-surface">{t('realEstate.offers.title')}</h1>
                    <p className="body-md text-on-surface-variant">{t('realEstate.offers.subtitle')}</p>
                </div>
                <div className="mb-4 flex flex-wrap gap-2" role="tablist">
                    {filters.map(f => (
                        <button
                            key={f || 'all'}
                            role="tab"
                            aria-selected={status === f}
                            onClick={() => setStatus(f)}
                            className={`px-4 py-2 rounded-lg body-md transition-colors ${status === f ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}
                        >
                            {f ? t(`realEstate.offers.status.${f}` as MessageKey) : t('realEstate.mandates.queue.all')}
                        </button>
                    ))}
                </div>
                <OffersPanel
                    workspaceId={workspaceId}
                    status={status || undefined}
                    canWrite={canWrite}
                    currency={info.currency}
                    refreshKey={0}
                    onChanged={() => {}}
                />
            </div>
        </AppShell>
    );
}

export default function OffersPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <OffersPageInner />
        </Suspense>
    );
}

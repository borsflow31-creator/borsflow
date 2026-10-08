'use client';

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building, Plus, Search, MapPin, Calendar, CheckCircle2, Clock, Layers } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { primaryButton, secondaryButton, inputClass } from '@/components/realestate/ui';
import ProgramFormModal from '@/components/developer/ProgramFormModal';
import { useWorkspaceCurrency } from '@/components/developer/useWorkspaceCurrency';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { Kpi, KpiGrid, Meter } from '@/components/developer/kpi';
import { PROJECT_STATUSES } from '@/lib/crm/projects';

function ProgramsPageInner() {
  const router = useRouter();
  const { workspaceId, ready } = useWorkspaceParam();
  const { t, formatNumber, locale } = useI18n();
  const currency = useWorkspaceCurrency(workspaceId);
  const money = (n: number) =>
    formatNumber(n, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });

  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchPrograms = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);

    const params = new URLSearchParams({ workspaceId });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);

    fetch(`/api/developer/programs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.programs) {
          setPrograms(data.programs);
        }
      })
      .catch((err) => {
        console.error('Error fetching programs:', err);
        setToast({ message: 'Failed to load projects', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [workspaceId, search, statusFilter]);

  useEffect(() => {
    if (ready && workspaceId) {
      fetchPrograms();
    }
  }, [ready, workspaceId, fetchPrograms]);

  // Overall metric totals across active programs
  const stats = useMemo(() => {
    let totalLots = 0;
    let available = 0;
    let reserved = 0;
    let sold = 0;

    for (const p of programs) {
      totalLots += p.totalUnits;
      available += p.availableUnits;
      reserved += p.reservedUnits;
      sold += p.soldUnits;
    }

    const preSaleRate = totalLots > 0 ? Math.round(((reserved + sold) / totalLots) * 100) : 0;

    return { totalPrograms: programs.length, totalLots, available, reserved, sold, preSaleRate };
  }, [programs]);

  if (!ready) return <PageSkeleton />;
  if (!workspaceId) {
    return (
      <AppShell>
        <NoWorkspace />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Bar */}
        <PageHeader
          icon={Building}
          title={t('realEstate.projects.title')}
          subtitle={t('developerGuide.desc.projects')}
          guide="projects"
          actions={
            <button
              onClick={() => setShowModal(true)}
              className={`${primaryButton} flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              <span>{t('developerDashboard.newProject')}</span>
            </button>
          }
        />

        {/* Across all projects, in the dashboard's own figures. */}
        <KpiGrid cols={5}>
          <Kpi label={t('realEstate.projects.title')} value={stats.totalPrograms} />
          <Kpi label={t('realEstate.projects.stats.totalUnits')} value={stats.totalLots} />
          <Kpi label={t('realEstate.projects.stats.available')} value={stats.available} tone="text-emerald-700 dark:text-emerald-400" />
          <Kpi label={t('realEstate.projects.stats.reserved')} value={stats.reserved} sub={t('realEstate.projects.stats.reservedHint')} tone="text-amber-700 dark:text-amber-400" />
          <Kpi label={t('realEstate.projects.stats.sellThrough')} value={`${stats.preSaleRate}%`} tone="text-secondary" />
        </KpiGrid>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest/50">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute start-3 top-3 text-on-surface-variant" />
            <input
              type="text"
              className={`${inputClass} ps-9`}
              placeholder={t('developerProjectList.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPrograms()}
            />
          </div>

          <div className="w-full sm:w-56">
            <select
              className={inputClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{t('developerProjectList.allStatuses')}</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>{t(`developerProjectPage.programStatus.${status}` as MessageKey)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Programs Grid */}
        {loading ? (
          <PageSkeleton />
        ) : programs.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-outline-variant/40 rounded-xl">
            <Building className="w-8 h-8 text-on-surface-variant/50 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-on-surface mb-1">{t('developerProjectList.emptyTitle')}</h3>
            <p className="text-sm text-on-surface-variant max-w-sm mx-auto mb-5">{t('developerProjectList.emptyBody')}</p>
            <button onClick={() => setShowModal(true)} className={primaryButton}>
              {t('developerProjectList.createFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.map((program) => {
              const sellRatio =
                program.totalUnits > 0
                  ? Math.round(((program.reservedUnits + program.soldUnits) / program.totalUnits) * 100)
                  : 0;

              return (
                <div
                  key={program.id}
                  className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest hover:border-secondary/40 transition-colors flex flex-col justify-between overflow-hidden"
                >
                  {/* Cover. A development is bought on how it looks, so the card
                      leads with the image when there is one and stays compact
                      when there is not. */}
                  {program.coverUrl && (
                    <div className="aspect-[16/9] bg-surface-container-high overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={program.coverUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-5 space-y-4">
                    {/* Header: Reference + Status badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                        {program.reference}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-secondary/10 text-secondary">
                        {t(`developerProjectPage.programStatus.${program.status}` as MessageKey)}
                      </span>
                    </div>

                    {/* Title & City */}
                    <div>
                      <h3 className="text-lg font-bold text-on-surface leading-snug">
                        {program.commercialName || program.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>
                          {program.city} {program.postalCode ? `(${program.postalCode})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Sales Progress Bar */}
                    <div className="space-y-1.5 pt-3 border-t border-outline-variant/20">
                      <div className="flex justify-between text-xs text-on-surface-variant">
                        <span>{t('developerSales.stage.title')}</span>
                        <span className="font-semibold text-on-surface tabular-nums">
                          {t('developerProjectList.soldReserved', { percent: sellRatio })}
                        </span>
                      </div>
                      <Meter percent={sellRatio} label={t('developerSales.stage.title')} />
                    </div>

                    {/* Sales against plan, and what is still owed. Targets are optional,
                        so each figure shows only what the project actually has. */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="block text-on-surface-variant">{t('developer.statusDeedSigned')}</span>
                        <strong className="text-on-surface text-sm tabular-nums">
                          {money(program.sales?.soldValue ?? 0)}
                        </strong>
                        {program.revenueTarget > 0 && (
                          <span className="text-on-surface-variant tabular-nums">
                            {' '}/ {money(program.revenueTarget)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="block text-on-surface-variant">{t('developer.outstanding')}</span>
                        <strong className="text-on-surface text-sm tabular-nums">
                          {money(program.sales?.outstanding ?? 0)}
                        </strong>
                      </div>
                    </div>
                    {program.salesTargetUnits > 0 && (
                      <p className="text-xs text-on-surface-variant tabular-nums">
                        {t('developer.soldOfTarget', { sold: program.soldUnits, target: program.salesTargetUnits })}
                        {' · '}
                        {t('developer.salesCompletion', {
                          percent: Math.round((program.soldUnits / program.salesTargetUnits) * 100),
                        })}
                      </p>
                    )}

                    {/* Unit distribution pills */}
                    <KpiGrid cols={4} fixed>
                      <Kpi compact label={t('developerProjectPage.statTotal')} value={program.totalUnits} />
                      <Kpi compact label={t('realEstate.projects.stats.available')} value={program.availableUnits} tone="text-emerald-700 dark:text-emerald-400" />
                      <Kpi compact label={t('realEstate.projects.stats.reserved')} value={program.reservedUnits} tone="text-amber-700 dark:text-amber-400" />
                      <Kpi compact label={t('realEstate.projects.stats.sold')} value={program.soldUnits} tone="text-secondary" />
                    </KpiGrid>

                    {program.launchDate && (
                      <p className="text-xs text-on-surface-variant">
                        {t('developer.launchDate')}:{' '}
                        {new Date(program.launchDate).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                      </p>
                    )}

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-xs text-on-surface-variant pt-3 border-t border-outline-variant/20">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {t('developerProjectPage.deliveryTarget', {
                            date: program.targetDeliveryDate
                              ? new Date(program.targetDeliveryDate).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
                              : t('developerProjectList.tbd'),
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{t('developerProjectList.buildings', { count: program.buildings?.length || 1 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Link */}
                  <div className="p-3 border-t border-outline-variant/20 flex justify-end">
                    <Link
                      href={`/developer/programs/${program.id}?workspace=${workspaceId}`}
                      className={`${primaryButton} text-xs py-1.5 px-3 flex items-center gap-1.5`}
                    >
                      <span>{t('developerProjectList.open')}</span>
                      <span className="rtl:rotate-180">→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ProgramFormModal
          workspaceId={workspaceId}
          onClose={() => setShowModal(false)}
          onSuccess={(newProgram) => {
            setShowModal(false);
            setToast({ message: t('developerProjectList.created'), type: 'success' });
            fetchPrograms();
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppShell>
  );
}

export default function ProgramsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProgramsPageInner />
    </Suspense>
  );
}

'use client';

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building, Plus, Search, MapPin, Calendar, CheckCircle2, Clock, Layers } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { primaryButton, secondaryButton, inputClass } from '@/components/realestate/ui';
import ProgramFormModal from '@/components/developer/ProgramFormModal';

function ProgramsPageInner() {
  const router = useRouter();
  const { workspaceId, ready } = useWorkspaceParam();

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
        setToast({ message: 'Failed to load developer programs', type: 'error' });
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-primary/10 text-primary rounded-lg">
                <Building className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold text-on-surface">Development Programs</h1>
            </div>
            <p className="text-sm text-on-surface-variant mt-1">
              Residential developments, interactive lot inventory, and construction milestone tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className={`${primaryButton} flex items-center gap-2`}
            >
              <Plus className="w-4 h-4" />
              <span>New Program</span>
            </button>
          </div>
        </div>

        {/* Global Developer Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
            <span className="text-xs font-medium text-on-surface-variant">Programs</span>
            <p className="text-2xl font-bold text-on-surface mt-1">{stats.totalPrograms}</p>
          </div>
          <div className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
            <span className="text-xs font-medium text-on-surface-variant">Total Lots</span>
            <p className="text-2xl font-bold text-on-surface mt-1">{stats.totalLots}</p>
          </div>
          <div className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
            <span className="text-xs font-medium text-emerald-600">Available</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.available}</p>
          </div>
          <div className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
            <span className="text-xs font-medium text-amber-600">Reserved / Optioned</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.reserved}</p>
          </div>
          <div className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
            <span className="text-xs font-medium text-blue-600">Pre-Sale Rate</span>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.preSaleRate}%</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-surface p-4 rounded-xl border border-surface-container-high shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-on-surface-variant" />
            <input
              type="text"
              className={`${inputClass} pl-9`}
              placeholder="Search programs by name, reference, or city..."
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
              <option value="">All Statuses</option>
              <option value="study">Feasibility / Study</option>
              <option value="commercialization">Commercialization</option>
              <option value="construction">Under Construction</option>
              <option value="delivery">Delivery Phase</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Programs Grid */}
        {loading ? (
          <PageSkeleton />
        ) : programs.length === 0 ? (
          <div className="p-12 text-center bg-surface rounded-xl border border-dashed border-surface-container-high">
            <Building className="w-12 h-12 text-on-surface-variant mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-semibold text-on-surface">No development programs yet</h3>
            <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
              Start by creating your first residential or commercial development project.
            </p>
            <button onClick={() => setShowModal(true)} className={`${primaryButton} mt-4`}>
              Create Program
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
                  className="bg-surface rounded-xl border border-surface-container-high shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Header: Reference + Status badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">
                        {program.reference}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium capitalize bg-primary/10 text-primary">
                        {program.status}
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
                    <div className="space-y-1.5 pt-2 border-t border-surface-container-high">
                      <div className="flex justify-between text-xs text-on-surface-variant">
                        <span>Commercialization</span>
                        <span className="font-semibold text-on-surface">{sellRatio}% Sold / Reserved</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden flex">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${sellRatio}%` }}
                        />
                      </div>
                    </div>

                    {/* Unit distribution pills */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-surface-container-high/60 rounded">
                        <span className="block text-on-surface-variant">Total</span>
                        <strong className="text-on-surface text-sm">{program.totalUnits}</strong>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded">
                        <span className="block text-emerald-700">Available</span>
                        <strong className="text-emerald-800 text-sm">{program.availableUnits}</strong>
                      </div>
                      <div className="p-2 bg-blue-50 rounded">
                        <span className="block text-blue-700">Reserved</span>
                        <strong className="text-blue-800 text-sm">
                          {program.reservedUnits + program.soldUnits}
                        </strong>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-surface-container-high">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          Delivery:{' '}
                          {program.targetDeliveryDate
                            ? new Date(program.targetDeliveryDate).toLocaleDateString('fr-FR', {
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'TBD'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{program.buildings?.length || 1} Building(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Link */}
                  <div className="p-3 bg-surface-container-high/30 border-t border-surface-container-high flex justify-end">
                    <Link
                      href={`/developer/programs/${program.id}?workspace=${workspaceId}`}
                      className={`${primaryButton} text-xs py-1.5 px-3 flex items-center gap-1.5`}
                    >
                      <span>Open Stacking Plan</span>
                      <span>→</span>
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
            setToast({ message: 'Program created successfully!', type: 'success' });
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

'use client';

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Building,
  Plus,
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  FileText,
  DollarSign,
  ShieldCheck,
  UserCheck,
  Lock,
  Unlock,
  Layers,
  Edit2,
  Trash2,
  Wrench,
  Sliders,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { primaryButton, secondaryButton, dangerButton } from '@/components/realestate/ui';
import LotModal from '@/components/developer/LotModal';
import OptionModal from '@/components/developer/OptionModal';
import ReserveModal from '@/components/developer/ReserveModal';
import CertifyMilestoneModal from '@/components/developer/CertifyMilestoneModal';
import TMAModal from '@/components/developer/TMAModal';
import TMAReviewModal from '@/components/developer/TMAReviewModal';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  available: {
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    label: 'Available',
  },
  optioned: {
    bg: 'bg-amber-50 hover:bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    label: 'On Hold (Option)',
  },
  reserved: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    label: 'Reserved',
  },
  contract_signed: {
    bg: 'bg-indigo-50 hover:bg-indigo-100',
    text: 'text-indigo-800',
    border: 'border-indigo-300',
    label: 'Contract Signed',
  },
  deed_signed: {
    bg: 'bg-purple-50 hover:bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    label: 'Deed Signed',
  },
  delivered: {
    bg: 'bg-gray-100 hover:bg-gray-200',
    text: 'text-gray-800',
    border: 'border-gray-300',
    label: 'Delivered',
  },
};

const TMA_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  requested: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Requested' },
  feasibility_approved: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Feasible (Pending Quote)' },
  quote_sent: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Quote Sent' },
  accepted: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Signed Addendum' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Completed on Site' },
};

function ProgramDetailPageInner() {
  const params = useParams();
  const programId = params.id as string;
  const { workspaceId, ready } = useWorkspaceParam();

  const [program, setProgram] = useState<any>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [callsForFunds, setCallsForFunds] = useState<any[]>([]);
  const [tmaRequests, setTmaRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stacking' | 'milestones' | 'tma' | 'table'>('stacking');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('all');
  const [selectedLot, setSelectedLot] = useState<any>(null);

  // Modals state
  const [showLotModal, setShowLotModal] = useState(false);
  const [editingLot, setEditingLot] = useState<any>(null);
  const [optionLot, setOptionLot] = useState<any>(null);
  const [reserveLot, setReserveLot] = useState<any>(null);
  const [certifyMilestone, setCertifyMilestone] = useState<any>(null);
  const [showTmaLot, setShowTmaLot] = useState<any>(null);
  const [reviewTma, setReviewTma] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedPortalToken, setCopiedPortalToken] = useState(false);

  const handleCopyBuyerPortal = (token: string) => {
    const fullUrl = `${window.location.origin}/view/buyer/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedPortalToken(true);
    setToast({ message: 'Buyer Portal link copied to clipboard!', type: 'success' });
    setTimeout(() => setCopiedPortalToken(false), 2500);
  };

  const fetchProgramData = useCallback(() => {
    if (!workspaceId || !programId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/developer/programs/${programId}?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/developer/programs/${programId}/lots?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/developer/calls-for-funds?workspaceId=${workspaceId}&programId=${programId}`).then((r) => r.json()),
      fetch(`/api/developer/tma?workspaceId=${workspaceId}&programId=${programId}`).then((r) => r.json()),
    ])
      .then(([progData, lotsData, callsData, tmaData]) => {
        if (progData.program) setProgram(progData.program);
        if (lotsData.lots) setLots(lotsData.lots);
        if (callsData.calls) setCallsForFunds(callsData.calls);
        if (tmaData.requests) setTmaRequests(tmaData.requests);

        // Keep selectedLot updated if it's currently open
        setSelectedLot((prev: any) => {
          if (!prev || !lotsData.lots) return prev;
          const fresh = lotsData.lots.find((l: any) => l.id === prev.id);
          return fresh || prev;
        });
      })
      .catch((err) => {
        console.error('Error loading program data:', err);
        setToast({ message: 'Error loading program details', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [workspaceId, programId]);

  useEffect(() => {
    if (ready && workspaceId && programId) {
      fetchProgramData();
    }
  }, [ready, workspaceId, programId, fetchProgramData]);

  // Set of lot IDs that have at least one active TMA request
  const lotsWithTma = useMemo(() => {
    const s = new Set<string>();
    for (const req of tmaRequests) {
      if (req.lotId) s.add(req.lotId);
    }
    return s;
  }, [tmaRequests]);

  // Total additional revenue from accepted TMAs
  const tmaStats = useMemo(() => {
    let acceptedTotal = 0;
    let pendingCount = 0;
    for (const req of tmaRequests) {
      if (req.status === 'accepted') {
        acceptedTotal += req.priceQuote || 0;
      } else if (req.status !== 'rejected') {
        pendingCount++;
      }
    }
    return { acceptedTotal, pendingCount };
  }, [tmaRequests]);

  // Group lots by building and floor for the visual elevation stacking plan
  const stackingFloors = useMemo(() => {
    const filteredLots =
      selectedBuildingId === 'all'
        ? lots
        : lots.filter((l) => l.buildingId === selectedBuildingId);

    // Group by floor number descending
    const floorsMap = new Map<number, any[]>();
    for (const lot of filteredLots) {
      const fl = lot.floor ?? 0;
      if (!floorsMap.has(fl)) floorsMap.set(fl, []);
      floorsMap.get(fl)!.push(lot);
    }

    // Sort floors descending (top floor on top, basement on bottom)
    const sortedFloorNumbers = Array.from(floorsMap.keys()).sort((a, b) => b - a);
    return sortedFloorNumbers.map((floorNum) => ({
      floorNumber: floorNum,
      label:
        floorNum === 0
          ? 'Ground Floor (RDC)'
          : floorNum < 0
          ? `Basement (S${Math.abs(floorNum)})`
          : `Floor ${floorNum} (R+${floorNum})`,
      lots: floorsMap.get(floorNum)!.sort((a, b) => a.lotNumber.localeCompare(b.lotNumber)),
    }));
  }, [lots, selectedBuildingId]);

  const handleReleaseOption = async (lotId: string) => {
    if (!confirm('Release this temporary hold and return unit to Available?')) return;
    try {
      const res = await fetch(`/api/developer/lots/${lotId}/option?workspaceId=${workspaceId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to release option');
      setToast({ message: 'Option released. Lot is now Available.', type: 'success' });
      setSelectedLot(null);
      fetchProgramData();
    } catch (err: any) {
      setToast({ message: err.message || 'Error releasing option', type: 'error' });
    }
  };

  if (!ready || loading) return <PageSkeleton />;
  if (!program) {
    return (
      <AppShell>
        <div className="p-8 text-center text-on-surface">Program not found.</div>
      </AppShell>
    );
  }

  // TMAs specifically belonging to the currently open lot drawer
  const currentLotTmas = selectedLot
    ? tmaRequests.filter((req) => req.lotId === selectedLot.id)
    : [];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Back Link & Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/developer/programs?workspace=${workspaceId}`}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Programs</span>
          </Link>

          <button
            onClick={() => {
              setEditingLot(null);
              setShowLotModal(true);
            }}
            className={`${primaryButton} flex items-center gap-1.5 text-xs py-1.5 px-3`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Unit / Lot</span>
          </button>
        </div>

        {/* Program Header Profile */}
        <div className="p-6 bg-surface rounded-2xl border border-surface-container-high shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold">
                  {program.reference}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium capitalize bg-primary/10 text-primary">
                  {program.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-on-surface mt-1">
                {program.commercialName || program.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant mt-2">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {program.city} {program.postalCode ? `(${program.postalCode})` : ''}
                </span>
                {program.targetDeliveryDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Delivery Target:{' '}
                    {new Date(program.targetDeliveryDate).toLocaleDateString('fr-FR', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                )}
                {program.gfaBank && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    GFA Guarantee: {program.gfaBank}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats Distribution */}
            <div className="flex items-center gap-3">
              <div className="p-3 bg-surface-container-high/60 rounded-xl text-center min-w-[70px]">
                <span className="block text-xs text-on-surface-variant">Total</span>
                <span className="text-xl font-bold text-on-surface">{lots.length}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-center min-w-[70px] border border-emerald-100">
                <span className="block text-xs text-emerald-700">Available</span>
                <span className="text-xl font-bold text-emerald-800">
                  {lots.filter((l) => l.status === 'available').length}
                </span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-center min-w-[70px] border border-amber-100">
                <span className="block text-xs text-amber-700">Optioned</span>
                <span className="text-xl font-bold text-amber-800">
                  {lots.filter((l) => l.status === 'optioned').length}
                </span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl text-center min-w-[70px] border border-blue-100">
                <span className="block text-xs text-blue-700">Reserved</span>
                <span className="text-xl font-bold text-blue-800">
                  {lots.filter(
                    (l) =>
                      l.status === 'reserved' ||
                      l.status === 'contract_signed' ||
                      l.status === 'deed_signed'
                  ).length}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-surface-container-high pt-2 gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('stacking')}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'stacking'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Interactive Stacking Plan</span>
            </button>

            <button
              onClick={() => setActiveTab('milestones')}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'milestones'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Milestones & Calls for Funds</span>
            </button>

            <button
              onClick={() => setActiveTab('tma')}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'tma'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>
                Change Orders (TMA) ({tmaRequests.length})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'table'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>All Units Table</span>
            </button>
          </div>
        </div>

        {/* TAB 1: INTERACTIVE STACKING PLAN */}
        {activeTab === 'stacking' && (
          <div className="space-y-6">
            {/* Stacking Controls & Color Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-on-surface-variant">Filter Building:</span>
                <select
                  className="text-xs py-1.5 px-3 rounded-lg border border-surface-container-high bg-surface text-on-surface"
                  value={selectedBuildingId}
                  onChange={(e) => setSelectedBuildingId(e.target.value)}
                >
                  <option value="all">All Buildings ({lots.length} lots)</option>
                  {program.buildings?.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Color Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  Option (Hold)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  Reserved
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  Deed Signed
                </span>
                <span className="flex items-center gap-1.5 text-primary font-medium">
                  <Wrench className="w-3 h-3 text-primary" />
                  Has TMA
                </span>
              </div>
            </div>

            {/* Visual Floor-by-Floor Grid (Stacking Elevation) */}
            {stackingFloors.length === 0 ? (
              <div className="p-12 text-center bg-surface rounded-xl border border-dashed border-surface-container-high">
                <Building className="w-12 h-12 text-on-surface-variant mx-auto mb-3 opacity-40" />
                <h3 className="text-lg font-semibold text-on-surface">No units on this elevation</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Click &quot;Add Unit / Lot&quot; to populate your development program.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {stackingFloors.map((floor) => (
                  <div
                    key={floor.floorNumber}
                    className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-on-surface-variant border-b border-surface-container-high/60 pb-2">
                      <span className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        {floor.label}
                      </span>
                      <span>{floor.lots.length} Unit(s)</span>
                    </div>

                    {/* Floor Units Tiles */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {floor.lots.map((lot: any) => {
                        const style = STATUS_COLORS[lot.status] || STATUS_COLORS.available;
                        const isSelected = selectedLot?.id === lot.id;
                        const hasTma = lotsWithTma.has(lot.id);

                        return (
                          <div
                            key={lot.id}
                            onClick={() => setSelectedLot(lot)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                              style.bg
                            } ${style.border} ${
                              isSelected ? 'ring-2 ring-primary shadow-md scale-[1.02]' : 'hover:shadow'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-sm text-on-surface">{lot.lotNumber}</span>
                              <div className="flex items-center gap-1">
                                {hasTma && (
                                  <span title="Active Change Order (TMA)">
                                    <Wrench className="w-3 h-3 text-primary" />
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/70 text-on-surface">
                                  {lot.typology || lot.type}
                                </span>
                              </div>
                            </div>

                            <div className="text-xs text-on-surface-variant space-y-0.5">
                              <div>
                                {lot.surfaceArea} m² {lot.orientation ? `· ${lot.orientation}` : ''}
                              </div>
                              <div className="font-bold text-on-surface">
                                {lot.totalPrice.toLocaleString('fr-FR', {
                                  style: 'currency',
                                  currency: 'EUR',
                                  maximumFractionDigits: 0,
                                })}
                              </div>
                            </div>

                            <div className="mt-2 pt-1 border-t border-black/5 flex items-center justify-between text-[11px]">
                              <span className={`font-semibold ${style.text}`}>{style.label}</span>
                              {lot.status === 'optioned' && <Clock className="w-3 h-3 text-amber-700" />}
                              {lot.status === 'reserved' && <UserCheck className="w-3 h-3 text-blue-700" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONSTRUCTION MILESTONES & CALLS FOR FUNDS */}
        {activeTab === 'milestones' && (
          <div className="space-y-6">
            <div className="p-6 bg-surface rounded-xl border border-surface-container-high shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Construction Milestones (*VEFA*)</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Statutory stages certified by the supervising architect. Certifying a milestone automatically issues calls for funds to all active buyers.
                </p>
              </div>

              {/* Milestone Timeline */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {program.milestones?.map((m: any) => (
                  <div
                    key={m.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      m.isCertified
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-surface border-surface-container-high'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                          Stage {m.order}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {m.targetPercentage}%
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-on-surface">{m.title}</h4>
                    </div>

                    <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between">
                      {m.isCertified ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>
                            Certified{' '}
                            {m.certifiedAt
                              ? new Date(m.certifiedAt).toLocaleDateString('fr-FR')
                              : ''}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCertifyMilestone(m)}
                          className={`${primaryButton} text-xs py-1 px-2.5 flex items-center gap-1`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Certify Stage</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calls for Funds Table */}
            <div className="p-6 bg-surface rounded-xl border border-surface-container-high shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Calls for Funds (*Appels de Fonds*)</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Stage invoices generated for purchasers across construction progress.
                  </p>
                </div>
                <span className="text-xs font-semibold text-on-surface-variant">
                  {callsForFunds.length} invoice notices
                </span>
              </div>

              {callsForFunds.length === 0 ? (
                <div className="p-8 text-center text-sm text-on-surface-variant">
                  No calls for funds issued yet. Certify a construction milestone to generate stage billings.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-surface-container-high text-on-surface-variant">
                        <th className="py-2.5 px-3">Call #</th>
                        <th className="py-2.5 px-3">Unit</th>
                        <th className="py-2.5 px-3">Buyer</th>
                        <th className="py-2.5 px-3">Milestone</th>
                        <th className="py-2.5 px-3">Tranche</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high">
                      {callsForFunds.map((call) => (
                        <tr key={call.id} className="hover:bg-surface-container-high/20">
                          <td className="py-2.5 px-3 font-mono font-medium">{call.callNumber}</td>
                          <td className="py-2.5 px-3 font-bold">{call.lot?.lotNumber}</td>
                          <td className="py-2.5 px-3">
                            {call.lot?.buyerLead
                              ? `${call.lot.buyerLead.firstName || ''} ${call.lot.buyerLead.lastName || ''}`
                              : 'Unassigned'}
                          </td>
                          <td className="py-2.5 px-3">{call.milestone?.title}</td>
                          <td className="py-2.5 px-3 font-semibold">{call.percentage}%</td>
                          <td className="py-2.5 px-3 font-bold">
                            {call.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                                call.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {call.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {call.invoiceId && (
                              <Link
                                href={`/invoices?workspace=${workspaceId}&id=${call.invoiceId}`}
                                className="text-primary hover:underline font-medium"
                              >
                                View Invoice
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TMA & CUSTOMIZATIONS */}
        {activeTab === 'tma' && (
          <div className="space-y-6">
            {/* TMA Stats Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
                <span className="text-xs text-on-surface-variant font-medium">Total Change Orders</span>
                <p className="text-2xl font-bold text-on-surface mt-1">{tmaRequests.length}</p>
              </div>
              <div className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
                <span className="text-xs text-amber-600 font-medium">Pending Review / Quotes</span>
                <p className="text-2xl font-bold text-amber-600 mt-1">{tmaStats.pendingCount}</p>
              </div>
              <div className="p-4 bg-surface rounded-xl border border-surface-container-high shadow-sm">
                <span className="text-xs text-emerald-600 font-medium">Signed Addenda Revenue</span>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {tmaStats.acceptedTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>

            {/* TMA Table */}
            <div className="p-6 bg-surface rounded-xl border border-surface-container-high shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Buyer Modifications (*TMA*)</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Structural and interior changes requested by buyers during construction. Accepted addenda update unit balances.
                  </p>
                </div>
              </div>

              {tmaRequests.length === 0 ? (
                <div className="p-12 text-center text-sm text-on-surface-variant border border-dashed border-surface-container-high rounded-xl">
                  <Wrench className="w-10 h-10 mx-auto mb-2 opacity-40 text-on-surface-variant" />
                  <p className="font-semibold text-on-surface">No change order requests yet</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Select a reserved unit in the Stacking Plan and click &quot;Request Customization (TMA)&quot; to begin.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-surface-container-high text-on-surface-variant font-semibold">
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-3">Unit</th>
                        <th className="py-2.5 px-3">Buyer</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Internal Cost</th>
                        <th className="py-2.5 px-3">Price Quote</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high">
                      {tmaRequests.map((req) => {
                        const style = TMA_STATUS_STYLES[req.status] || TMA_STATUS_STYLES.requested;
                        return (
                          <tr key={req.id} className="hover:bg-surface-container-high/20">
                            <td className="py-2.5 px-3 font-mono font-bold">{req.reference}</td>
                            <td className="py-2.5 px-3 font-bold">{req.lot?.lotNumber}</td>
                            <td className="py-2.5 px-3">
                              {req.buyerLead
                                ? `${req.buyerLead.firstName || ''} ${req.buyerLead.lastName || ''}`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-medium uppercase">{req.category}</td>
                            <td className="py-2.5 px-3 max-w-xs truncate" title={req.title}>
                              {req.title}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${style.text} ${style.bg}`}>
                                {style.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-on-surface-variant">
                              {req.costEstimate > 0
                                ? req.costEstimate.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-primary">
                              {req.priceQuote > 0
                                ? req.priceQuote.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => setReviewTma(req)}
                                className={`${secondaryButton} text-xs py-1 px-2.5`}
                              >
                                Review / Quote
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ALL UNITS TABLE */}
        {activeTab === 'table' && (
          <div className="p-6 bg-surface rounded-xl border border-surface-container-high shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface">All Units Inventory</h3>
              <span className="text-xs text-on-surface-variant">{lots.length} total units</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-container-high text-on-surface-variant font-semibold">
                    <th className="py-3 px-3">Lot #</th>
                    <th className="py-3 px-3">Building</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Floor</th>
                    <th className="py-3 px-3">Surface</th>
                    <th className="py-3 px-3">Price Pre-Tax</th>
                    <th className="py-3 px-3">Total Incl. VAT</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Buyer / Holder</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {lots.map((lot) => {
                    const style = STATUS_COLORS[lot.status] || STATUS_COLORS.available;
                    return (
                      <tr key={lot.id} className="hover:bg-surface-container-high/20">
                        <td className="py-3 px-3 font-bold">{lot.lotNumber}</td>
                        <td className="py-3 px-3 text-on-surface-variant">
                          {lot.building?.name || 'Main'}
                        </td>
                        <td className="py-3 px-3 font-medium uppercase">{lot.typology || lot.type}</td>
                        <td className="py-3 px-3">
                          {lot.floor === 0 ? 'RDC' : lot.floor > 0 ? `+${lot.floor}` : lot.floor}
                        </td>
                        <td className="py-3 px-3">{lot.surfaceArea} m²</td>
                        <td className="py-3 px-3 font-mono">
                          {lot.basePrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold">
                          {lot.totalPrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${style.text} ${style.bg}`}>
                            {style.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant">
                          {lot.buyerLead
                            ? `${lot.buyerLead.firstName || ''} ${lot.buyerLead.lastName || ''}`
                            : lot.optionHolderLead
                            ? `Hold: ${lot.optionHolderLead.firstName || ''}`
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingLot(lot);
                              setShowLotModal(true);
                            }}
                            className="p-1 hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Selected Lot Drawer / Slide-Over Modal */}
        {selectedLot && (
          <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
            <div className="w-full max-w-md bg-surface h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
                  <div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                      Unit Card
                    </span>
                    <h2 className="text-xl font-bold text-on-surface mt-1">Lot {selectedLot.lotNumber}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedLot(null)}
                    className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Status Badge & Fast Action Bar */}
                <div className="p-4 bg-surface-container-high/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-on-surface-variant">Current Status</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        STATUS_COLORS[selectedLot.status]?.text
                      } ${STATUS_COLORS[selectedLot.status]?.bg}`}
                    >
                      {STATUS_COLORS[selectedLot.status]?.label}
                    </span>
                  </div>

                  {/* Actions according to status */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-container-high">
                    {selectedLot.status === 'available' && (
                      <>
                        <button
                          onClick={() => setOptionLot(selectedLot)}
                          className={`${secondaryButton} text-xs py-2 flex items-center justify-center gap-1.5`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Put on Hold (48h)</span>
                        </button>
                        <button
                          onClick={() => setReserveLot(selectedLot)}
                          className={`${primaryButton} text-xs py-2 flex items-center justify-center gap-1.5`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Reserve Unit</span>
                        </button>
                      </>
                    )}

                    {selectedLot.status === 'optioned' && (
                      <>
                        <button
                          onClick={() => handleReleaseOption(selectedLot.id)}
                          className={`${dangerButton} text-xs py-2 flex items-center justify-center gap-1.5`}
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Release Hold</span>
                        </button>
                        <button
                          onClick={() => setReserveLot(selectedLot)}
                          className={`${primaryButton} text-xs py-2 flex items-center justify-center gap-1.5`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Confirm Reserve</span>
                        </button>
                      </>
                    )}

                    {selectedLot.status === 'reserved' && (
                      <div className="col-span-2 text-center text-xs text-blue-800 font-semibold p-2 bg-blue-50 rounded">
                        Unit is reserved. Subsequent calls for funds apply.
                      </div>
                    )}
                  </div>
                </div>

                {/* Hybrid Buyer Construction Portal */}
                {selectedLot.publicToken && (
                  <div className="p-3.5 bg-gradient-to-br from-amber-500/10 via-slate-900/5 to-primary/10 rounded-xl border border-amber-500/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                        <ShieldCheck className="w-4 h-4 text-amber-500" />
                        <span>Client Construction Space</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Hybrid Security
                      </span>
                    </div>

                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      Public 24-month construction diary & drone photo feed. Invoices, calls for funds, and TMA signatures are protected by on-demand 6-digit OTP sent to registered buyer.
                    </p>

                    {selectedLot.buyerLead?.email ? (
                      <div className="p-2 bg-surface rounded-lg border border-surface-container-high text-[11px] space-y-0.5">
                        <span className="text-on-surface-variant block text-[10px] font-semibold">Registered Buyer:</span>
                        <strong className="text-on-surface block truncate">
                          {selectedLot.buyerLead.firstName} {selectedLot.buyerLead.lastName} ({selectedLot.buyerLead.email})
                        </strong>
                      </div>
                    ) : selectedLot.optionHolderLead?.email ? (
                      <div className="p-2 bg-surface rounded-lg border border-surface-container-high text-[11px] space-y-0.5">
                        <span className="text-on-surface-variant block text-[10px] font-semibold">Option Holder:</span>
                        <strong className="text-on-surface block truncate">
                          {selectedLot.optionHolderLead.firstName} {selectedLot.optionHolderLead.lastName} ({selectedLot.optionHolderLead.email})
                        </strong>
                      </div>
                    ) : (
                      <div className="p-2 bg-surface rounded-lg border border-dashed border-surface-container-high text-[11px] text-on-surface-variant italic">
                        No purchaser attached yet. Link can be previewed or sent to prospective buyers.
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyBuyerPortal(selectedLot.publicToken)}
                        className={`${secondaryButton} text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5`}
                      >
                        {copiedPortalToken ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Copied Link!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`/view/buyer/${selectedLot.publicToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${primaryButton} text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Portal</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Characteristics */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Specifications
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-surface-container-high/30 rounded-lg">
                      <span className="text-on-surface-variant block">Typology</span>
                      <strong className="text-on-surface text-sm uppercase">
                        {selectedLot.typology || selectedLot.type}
                      </strong>
                    </div>
                    <div className="p-3 bg-surface-container-high/30 rounded-lg">
                      <span className="text-on-surface-variant block">Habitable Surface</span>
                      <strong className="text-on-surface text-sm">{selectedLot.surfaceArea} m²</strong>
                    </div>
                    <div className="p-3 bg-surface-container-high/30 rounded-lg">
                      <span className="text-on-surface-variant block">Floor</span>
                      <strong className="text-on-surface text-sm">
                        {selectedLot.floor === 0 ? 'Ground' : `Floor ${selectedLot.floor}`}
                      </strong>
                    </div>
                    <div className="p-3 bg-surface-container-high/30 rounded-lg">
                      <span className="text-on-surface-variant block">Orientation</span>
                      <strong className="text-on-surface text-sm">
                        {selectedLot.orientation || 'South'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Pricing Breakdown
                  </h4>
                  <div className="p-4 bg-surface-container-high/40 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Pre-Tax Base (HT)</span>
                      <span className="font-mono font-medium">
                        {selectedLot.basePrice.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">VAT ({selectedLot.taxRate}%)</span>
                      <span className="font-mono font-medium">
                        {(selectedLot.totalPrice - selectedLot.basePrice).toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-surface-container-high text-primary">
                      <span>Total All-Inclusive</span>
                      <span>
                        {selectedLot.totalPrice.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Buyer Customization & Change Orders (TMA) */}
                <div className="space-y-3 pt-2 border-t border-surface-container-high">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Customizations (*TMA*)
                    </h4>
                    {(selectedLot.status === 'optioned' ||
                      selectedLot.status === 'reserved' ||
                      selectedLot.status === 'contract_signed') && (
                      <button
                        onClick={() => setShowTmaLot(selectedLot)}
                        className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Request TMA</span>
                      </button>
                    )}
                  </div>

                  {currentLotTmas.length === 0 ? (
                    <p className="text-xs text-on-surface-variant italic">No change orders on this lot.</p>
                  ) : (
                    <div className="space-y-2">
                      {currentLotTmas.map((req: any) => {
                        const style = TMA_STATUS_STYLES[req.status] || TMA_STATUS_STYLES.requested;
                        return (
                          <div
                            key={req.id}
                            onClick={() => setReviewTma(req)}
                            className="p-2.5 rounded-lg border border-surface-container-high bg-surface hover:border-primary/50 cursor-pointer transition-all space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-on-surface">{req.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${style.text} ${style.bg}`}>
                                {style.label}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-on-surface-variant">
                              <span className="font-mono uppercase">{req.category}</span>
                              {req.priceQuote > 0 && (
                                <span className="font-bold text-primary">
                                  +
                                  {req.priceQuote.toLocaleString('fr-FR', {
                                    style: 'currency',
                                    currency: 'EUR',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-surface-container-high flex gap-3">
                <button
                  onClick={() => {
                    setEditingLot(selectedLot);
                    setShowLotModal(true);
                  }}
                  className={`${secondaryButton} flex-1 text-xs py-2`}
                >
                  Edit Lot Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lot Create/Edit Modal */}
      {showLotModal && (
        <LotModal
          workspaceId={workspaceId}
          programId={programId}
          buildings={program.buildings || []}
          initialLot={editingLot}
          onClose={() => {
            setShowLotModal(false);
            setEditingLot(null);
          }}
          onSuccess={(savedLot) => {
            setShowLotModal(false);
            setEditingLot(null);
            setSelectedLot(savedLot);
            setToast({ message: 'Lot saved successfully!', type: 'success' });
            fetchProgramData();
          }}
        />
      )}

      {/* Option Lock Modal */}
      {optionLot && (
        <OptionModal
          workspaceId={workspaceId}
          lot={optionLot}
          onClose={() => setOptionLot(null)}
          onSuccess={(updated) => {
            setOptionLot(null);
            setSelectedLot(updated);
            setToast({ message: 'Lot locked on temporary hold!', type: 'success' });
            fetchProgramData();
          }}
        />
      )}

      {/* Reservation Modal */}
      {reserveLot && (
        <ReserveModal
          workspaceId={workspaceId}
          lot={reserveLot}
          onClose={() => setReserveLot(null)}
          onSuccess={(updated) => {
            setReserveLot(null);
            setSelectedLot(updated);
            setToast({ message: 'Lot reserved successfully!', type: 'success' });
            fetchProgramData();
          }}
        />
      )}

      {/* Certify Milestone Modal */}
      {certifyMilestone && (
        <CertifyMilestoneModal
          workspaceId={workspaceId}
          milestone={certifyMilestone}
          onClose={() => setCertifyMilestone(null)}
          onSuccess={(result) => {
            setCertifyMilestone(null);
            const count = result.billingResult?.generatedCount || 0;
            setToast({
              message: `Milestone certified! ${count} Call(s) for Funds generated.`,
              type: 'success',
            });
            fetchProgramData();
          }}
        />
      )}

      {/* TMA Request Modal */}
      {showTmaLot && (
        <TMAModal
          workspaceId={workspaceId}
          lot={showTmaLot}
          onClose={() => setShowTmaLot(null)}
          onSuccess={(newTma) => {
            setShowTmaLot(null);
            setToast({ message: `Change order ${newTma.reference} submitted!`, type: 'success' });
            fetchProgramData();
          }}
        />
      )}

      {/* TMA Technical Review & Sign-Off Modal */}
      {reviewTma && (
        <TMAReviewModal
          workspaceId={workspaceId}
          tma={reviewTma}
          onClose={() => setReviewTma(null)}
          onSuccess={(updatedTma) => {
            setReviewTma(null);
            setToast({ message: `TMA ${updatedTma.reference} updated successfully!`, type: 'success' });
            fetchProgramData();
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppShell>
  );
}

export default function ProgramDetailPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProgramDetailPageInner />
    </Suspense>
  );
}

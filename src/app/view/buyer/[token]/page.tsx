'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Building2,
  Calendar,
  MapPin,
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  DollarSign,
  Wrench,
  Camera,
  Play,
  Mail,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Printer,
  PenTool,
  Plus,
  AlertCircle,
  Check,
} from 'lucide-react';

export default function BuyerPortalPage() {
  const { token } = useParams<{ token: string }>();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'journal' | 'unit' | 'financial' | 'tma'>('journal');

  // OTP Unlock State
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<{ maskedEmail?: string; devCode?: string } | null>(null);

  // Signing TMA State
  const [signingTma, setSigningTma] = useState<any>(null);
  const [signatureName, setSignatureName] = useState('');
  const [signatureAccepted, setSignatureAccepted] = useState(false);
  const [signSubmitting, setSignSubmitting] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  // Requesting TMA State
  const [showRequestTmaModal, setShowRequestTmaModal] = useState(false);
  const [tmaCategory, setTmaCategory] = useState('finishes');
  const [tmaTitle, setTmaTitle] = useState('');
  const [tmaDescription, setTmaDescription] = useState('');
  const [tmaSubmitting, setTmaSubmitting] = useState(false);

  // Load sessionToken from localStorage if previously stored
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`buyer_session_${token}`);
      if (stored) setSessionToken(stored);
    }
  }, [token]);

  const loadPortalData = useCallback(() => {
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    fetch(`/api/public/buyer/${token}`, { headers })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load portal');
        setData(json);
      })
      .catch((err) => {
        console.error('Error loading portal:', err);
        setError(err.message || 'Error loading construction portal');
      })
      .finally(() => setLoading(false));
  }, [token, sessionToken]);

  useEffect(() => {
    if (token) {
      loadPortalData();
    }
  }, [token, loadPortalData]);

  const handleSendOtp = async () => {
    setOtpLoading(true);
    setOtpError(null);

    try {
      const res = await fetch(`/api/public/buyer/${token}/otp/send`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send verification code');

      setOtpInfo(json);
      setOtpStep('verify');
      if (json.devCode) {
        setOtpCode(json.devCode); // Pre-fill in dev mode for instant testability
      }
    } catch (err: any) {
      setOtpError(err.message || 'Error sending code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;

    setOtpLoading(true);
    setOtpError(null);

    try {
      const res = await fetch(`/api/public/buyer/${token}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Invalid code');

      if (json.sessionToken) {
        setSessionToken(json.sessionToken);
        localStorage.setItem(`buyer_session_${token}`, json.sessionToken);
        setShowOtpModal(false);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLockSession = () => {
    setSessionToken(null);
    localStorage.removeItem(`buyer_session_${token}`);
  };

  const handleRequestTma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmaTitle.trim() || !tmaDescription.trim()) return;
    setTmaSubmitting(true);
    try {
      const res = await fetch(`/api/public/buyer/${token}/tma`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: tmaTitle.trim(),
          description: tmaDescription.trim(),
          category: tmaCategory,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit request');
      setShowRequestTmaModal(false);
      setTmaTitle('');
      setTmaDescription('');
      loadPortalData();
    } catch (err: any) {
      alert(err.message || 'Error submitting request');
    } finally {
      setTmaSubmitting(false);
    }
  };

  const handleSignTma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signingTma || !signatureName.trim() || !signatureAccepted) return;
    setSignSubmitting(true);
    setSignError(null);
    try {
      const res = await fetch(`/api/public/buyer/${token}/tma/${signingTma.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ signatureName: signatureName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to sign addendum');
      setSigningTma(null);
      setSignatureName('');
      setSignatureAccepted(false);
      loadPortalData();
    } catch (err: any) {
      setSignError(err.message || 'Failed to sign addendum');
    } finally {
      setSignSubmitting(false);
    }
  };

  const callsForFunds = data?.callsForFunds;
  const pricing = data?.pricing;
  const program = data?.program;

  const totalPaid = useMemo(() => {
    if (!callsForFunds) return 0;
    return callsForFunds
      .filter((c: any) => c.status === 'paid')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  }, [callsForFunds]);

  const totalCalled = useMemo(() => {
    if (!callsForFunds) return 0;
    return callsForFunds.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  }, [callsForFunds]);

  const remainingBalance = useMemo(() => {
    if (!pricing?.totalPrice) return 0;
    return Math.max(0, pricing.totalPrice - totalPaid);
  }, [pricing, totalPaid]);

  const certifiedMilestones = useMemo(() => {
    if (!program?.milestones) return [];
    return program.milestones.filter((m: any) => m.isCertified);
  }, [program?.milestones]);

  const currentCompletionPercent = useMemo(() => {
    return certifiedMilestones.length > 0
      ? certifiedMilestones[certifiedMilestones.length - 1].targetPercentage
      : 0;
  }, [certifiedMilestones]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Connecting to your development space...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-600">{error || 'This link is no longer valid or has expired.'}</p>
          <p className="text-xs text-slate-400">
            Please check the link received in your developer email or contact your representative.
          </p>
        </div>
      </div>
    );
  }

  const { lot, buyer, isVerified, tmaRequests, snags } = data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top Banner / Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-white/10 rounded-lg">
              <Building2 className="w-5 h-5 text-amber-400" />
            </span>
            <div>
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block leading-tight">
                Client Space
              </span>
              <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-md">
                {program.name}
              </h1>
            </div>
          </div>

          {/* Security Status Pill */}
          <div className="flex items-center gap-3">
            {isVerified ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Secure Financial Space</span>
                </span>
                <button
                  onClick={handleLockSession}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-700 hover:border-slate-500 transition-colors"
                >
                  Lock
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setOtpStep('request');
                  setShowOtpModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Unlock Financial Space</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 text-white pt-8 pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Lot {lot.lotNumber}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-slate-200 uppercase">
                  {lot.typology || lot.type} · {lot.surfaceArea} m²
                </span>
                {lot.floor !== undefined && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-slate-200">
                    {lot.floor === 0 ? 'Ground Floor' : `Floor ${lot.floor}`}
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome, {buyer.displayName}
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>
                  {program.addressLine ? `${program.addressLine}, ` : ''}
                  {program.city} {program.postalCode}
                </span>
              </p>
            </div>

            {program.targetDeliveryDate && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm sm:text-right">
                <span className="text-[11px] font-medium text-slate-400 block">Target Handover</span>
                <span className="text-base font-bold text-amber-400 flex items-center sm:justify-end gap-1.5 mt-0.5">
                  <Calendar className="w-4 h-4" />
                  {new Date(program.targetDeliveryDate).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Construction Progress Bar Tracker */}
          <div className="p-4 sm:p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-200">Physical Construction Progress</span>
              <span className="font-bold text-amber-400 text-sm">{currentCompletionPercent}% Completed</span>
            </div>

            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex p-0.5">
              <div
                className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${currentCompletionPercent}%` }}
              />
            </div>

            {/* Statutory Stage Dots */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 text-center">
              {program.milestones.map((m: any) => (
                <div key={m.id} className="space-y-1">
                  <div className="flex items-center justify-center">
                    {m.isCertified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border-2 border-slate-600 block" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate" title={m.title}>
                    {m.title}
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 block">{m.targetPercentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Portal Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-1 flex overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'journal'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Site Journal</span>
          </button>

          <button
            onClick={() => setActiveTab('unit')}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'unit'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>My Unit</span>
          </button>

          <button
            onClick={() => setActiveTab('financial')}
            className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'financial'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Calls for Funds</span>
            {!isVerified && <Lock className="w-3 h-3 text-amber-500 ml-0.5" />}
          </button>

          <button
            onClick={() => setActiveTab('tma')}
            className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'tma'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Change Orders (TMA)</span>
            {!isVerified && <Lock className="w-3 h-3 text-amber-500 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* TAB 1: SITE JOURNAL */}
        {activeTab === 'journal' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Construction Timeline & Drone Updates</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Regular progress updates certified by the site management team.
                  </p>
                </div>
              </div>

              {/* Feed items */}
              {program.media && program.media.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {program.media.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group hover:shadow-md transition-all"
                    >
                      <div className="aspect-video bg-slate-800 flex items-center justify-center relative overflow-hidden">
                        {item.kind === 'drone' || item.kind === 'video' ? (
                          <div className="flex flex-col items-center gap-2 text-white">
                            <span className="p-3 bg-white/20 backdrop-blur-sm rounded-full group-hover:scale-110 transition-transform">
                              <Play className="w-6 h-6 fill-white" />
                            </span>
                            <span className="text-xs font-semibold">Aerial Drone Tour</span>
                          </div>
                        ) : (
                          <Camera className="w-8 h-8 text-slate-500" />
                        )}
                      </div>
                      <div className="p-4 space-y-1">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
                          {item.updateMonth || 'Recent Update'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{item.title || 'Site Progress Photo'}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Recent photos are being processed</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    The supervising engineer will publish the next monthly drone flyover and stage photos shortly.
                  </p>
                </div>
              )}
            </div>

            {/* Project Accreditation & Bank Guarantees */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldCheck className="w-5 h-5" />
                <h4 className="text-sm font-bold uppercase tracking-wider">Statutory Protections & Accreditations</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                  <span className="text-slate-400 block text-[11px]">Financial Completion Guarantee</span>
                  <strong className="text-white block font-medium">
                    {program.gfaBank || 'GFA Extrinsèque (Garantie de Fin d\'Achèvement)'}
                  </strong>
                  <span className="text-[10px] text-emerald-400 block">Bank-secured completion</span>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                  <span className="text-slate-400 block text-[11px]">Supervising Architect</span>
                  <strong className="text-white block font-medium">
                    {program.architectName || 'Registered Architecture Firm (DPLG)'}
                  </strong>
                  <span className="text-[10px] text-slate-300 block">Stage certifications</span>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                  <span className="text-slate-400 block text-[11px]">Legal Framework</span>
                  <strong className="text-white block font-medium">VEFA (Off-Plan Sale)</strong>
                  <span className="text-[10px] text-slate-300 block">CCH Art. L. 261-1 et seq.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY UNIT SPECS */}
        {activeTab === 'unit' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Unit Specifications & Annexes</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Technical layout details for Lot {lot.lotNumber}.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 block">Typology</span>
                <strong className="text-lg font-bold text-slate-900 uppercase">
                  {lot.typology || lot.type}
                </strong>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 block">Habitable Area</span>
                <strong className="text-lg font-bold text-slate-900">{lot.surfaceArea} m²</strong>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 block">Floor Level</span>
                <strong className="text-lg font-bold text-slate-900">
                  {lot.floor === 0 ? 'Ground' : `Floor ${lot.floor}`}
                </strong>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-500 block">Orientation</span>
                <strong className="text-lg font-bold text-slate-900">{lot.orientation || 'South'}</strong>
              </div>
            </div>

            {/* Annexes */}
            {lot.annexes && lot.annexes.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900">Associated Lots (Parking / Cellar)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lot.annexes.map((annex: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-900">Lot {annex.lotNumber}</span>
                      <span className="px-2 py-0.5 rounded bg-white font-medium capitalize text-slate-600">
                        {annex.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery Snagging & Warranties (GPA) */}
            {isVerified && snags && snags.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Post-Handover Warranty & Snagging (*GPA*)</h4>
                    <p className="text-xs text-slate-500">Statutory 1-year perfect completion guarantee (*Garantie de Parfait Achèvement*).</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    {snags.filter((s: any) => s.status !== 'resolved').length} open / {snags.length} total
                  </span>
                </div>

                <div className="space-y-2">
                  {snags.map((snag: any) => (
                    <div
                      key={snag.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{snag.roomLocation || 'General'}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              snag.severity === 'critical'
                                ? 'bg-red-100 text-red-800'
                                : snag.severity === 'major'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {snag.severity}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${
                              snag.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {snag.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-slate-600">{snag.description}</p>
                      </div>

                      {snag.tradeContractor && (
                        <div className="sm:text-right text-[11px] text-slate-500">
                          <span>Trade: </span>
                          <strong className="text-slate-800">{snag.tradeContractor}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FINANCIAL SPACE & CALLS FOR FUNDS */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            {!isVerified ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center max-w-lg mx-auto space-y-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Protected Financial Information</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    To access your official stage payment notices (*Appels de fonds*), invoices, and mortgage lending letters, please verify your identity using a 6-digit code.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>Code will be sent to: <strong>{buyer.maskedEmail}</strong></span>
                </div>

                <button
                  onClick={() => {
                    setOtpStep('request');
                    setShowOtpModal(true);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Send Verification Code (OTP)
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                {/* Financial Summary Metric Tiles */}
                {pricing && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-500 block">Total Agreed Price (TTC)</span>
                      <strong className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {pricing.totalPrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </strong>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-500 block">Total Invoiced Calls</span>
                      <strong className="text-base sm:text-lg font-bold text-slate-800 font-mono mt-0.5 block">
                        {totalCalled.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </strong>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-medium text-emerald-700 block">Total Payments Received</span>
                      <strong className="text-base sm:text-lg font-bold text-emerald-800 font-mono mt-0.5 block">
                        {totalPaid.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </strong>
                    </div>

                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-[11px] font-medium text-amber-700 block">Remaining Balance</span>
                      <strong className="text-base sm:text-lg font-bold text-amber-900 font-mono mt-0.5 block">
                        {remainingBalance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Stage Invoices (*Appels de Fonds*)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Statutory stage billing schedule according to certified construction milestones.
                    </p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm print:hidden"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Print Statement</span>
                  </button>
                </div>

                {callsForFunds && callsForFunds.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                          <th className="py-2.5 px-3">Call Notice #</th>
                          <th className="py-2.5 px-3">Milestone</th>
                          <th className="py-2.5 px-3">Tranche</th>
                          <th className="py-2.5 px-3">Amount Due</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Document</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {callsForFunds.map((call: any) => (
                          <tr key={call.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3 font-mono font-medium">{call.callNumber}</td>
                            <td className="py-3 px-3 font-semibold text-slate-900">{call.milestoneTitle}</td>
                            <td className="py-3 px-3 font-bold">{call.percentage}%</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">
                              {call.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                            </td>
                            <td className="py-3 px-3">
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
                            <td className="py-3 px-3 text-right">
                              {call.invoiceToken ? (
                                <a
                                  href={`/view/invoice/${call.invoiceToken}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline font-semibold flex items-center justify-end gap-1"
                                >
                                  <span>View Receipt</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-slate-400">Available soon</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-4">No calls for funds issued yet.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CHANGE ORDERS (TMA) */}
        {activeTab === 'tma' && (
          <div className="space-y-6">
            {!isVerified ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center max-w-lg mx-auto space-y-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Protected Customization Portal</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Verify your identity with an OTP code to view your approved change orders (*TMA*), track quotes, and sign addenda.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setOtpStep('request');
                    setShowOtpModal(true);
                  }}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Unlock with Email Code (OTP)
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Customizations & Change Orders (*TMA*)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Personalize your finishes and layout modifications with the developer.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRequestTmaModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Request Customization</span>
                  </button>
                </div>

                {tmaRequests && tmaRequests.length > 0 ? (
                  <div className="space-y-4">
                    {tmaRequests.map((tma: any) => {
                      const isPendingSignature =
                        tma.status === 'quote_sent' ||
                        (tma.priceQuote > 0 && tma.status !== 'accepted' && tma.status !== 'rejected');

                      return (
                        <div
                          key={tma.id}
                          className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-500">{tma.reference}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 uppercase border border-slate-200">
                                {tma.category}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                                  tma.status === 'accepted'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : tma.status === 'rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {tma.status.replace('_', ' ')}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-xs text-slate-500 block sm:inline sm:mr-2">Quoted Cost:</span>
                              <span className="text-sm font-bold text-slate-900 font-mono">
                                {tma.priceQuote > 0
                                  ? tma.priceQuote.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
                                  : 'Under Estimation'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{tma.title}</h4>
                            <p className="text-xs text-slate-600 mt-0.5">{tma.description}</p>
                          </div>

                          {/* Action Bar for Pending Signature */}
                          {isPendingSignature && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="space-y-0.5">
                                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                  <PenTool className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Official Quote Ready for Your Signature</span>
                                </span>
                                <p className="text-[11px] text-slate-600">
                                  Price Quote: <strong className="font-mono font-bold text-slate-900">{tma.priceQuote.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</strong>
                                  {tma.techApproverNote ? ` · Technical Note: "${tma.techApproverNote}"` : ''}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setSigningTma(tma);
                                  setSignatureName(buyer.displayName || '');
                                  setSignatureAccepted(false);
                                  setSignError(null);
                                }}
                                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
                              >
                                <PenTool className="w-3.5 h-3.5 text-amber-400" />
                                <span>Review & Sign Addendum</span>
                              </button>
                            </div>
                          )}

                          {/* Signed Addendum confirmation */}
                          {tma.status === 'accepted' && (
                            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex items-center justify-between">
                              <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>{tma.signedAddendumDoc || 'Addendum Signed Digitally'}</span>
                              </span>
                              {tma.signedAt && (
                                <span className="text-slate-500 text-[11px]">
                                  {new Date(tma.signedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-4">No change orders submitted for this unit.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* OTP Unlock Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Verify Identity</h3>
              <button
                onClick={() => setShowOtpModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {otpError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {otpError}
              </div>
            )}

            {otpStep === 'request' ? (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Receive a One-Time Code</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    We will send a 6-digit confirmation code to your registered contact address:
                  </p>
                  <strong className="text-xs text-slate-900 block pt-1">{buyer.maskedEmail}</strong>
                </div>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {otpLoading ? 'Sending...' : 'Send 6-Digit Code'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs text-slate-500">Enter the 6-digit code sent to:</p>
                  <strong className="text-xs text-slate-900 block">{otpInfo?.maskedEmail}</strong>
                  {otpInfo?.devCode && (
                    <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold mt-1">
                      Test Code: {otpInfo.devCode}
                    </span>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    maxLength={6}
                    className="w-full text-center tracking-[0.5em] text-2xl font-mono font-bold py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="••••••"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpStep('request')}
                    className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Resend
                  </button>
                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length < 6}
                    className="flex-1 py-2.5 px-4 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {otpLoading ? 'Verifying...' : 'Verify & Unlock'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Buyer TMA Customization Request Modal */}
      {showRequestTmaModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-slate-100 rounded-lg text-slate-700">
                  <Wrench className="w-5 h-5 text-amber-500" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Request Customization (*TMA*)</h3>
                  <p className="text-xs text-slate-500">Lot {lot.lotNumber} · {lot.typology || lot.type}</p>
                </div>
              </div>
              <button
                onClick={() => setShowRequestTmaModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestTma} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={tmaCategory}
                  onChange={(e) => setTmaCategory(e.target.value)}
                  className="w-full text-xs py-2.5 px-3 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="finishes">Finishes & Paint</option>
                  <option value="electrical">Electrical & Outlets</option>
                  <option value="plumbing">Plumbing & Sanitary</option>
                  <option value="masonry">Partitions & Layout</option>
                  <option value="flooring">Flooring & Tiling</option>
                  <option value="other">Other Upgrade</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title of Request *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Additional electrical outlet on kitchen island"
                  value={tmaTitle}
                  onChange={(e) => setTmaTitle(e.target.value)}
                  className="w-full text-xs py-2.5 px-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detailed Specifications & Location *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your desired modification, exact room, and dimensions..."
                  value={tmaDescription}
                  onChange={(e) => setTmaDescription(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Technical Review Process</span>
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Your request will be submitted directly to the site manager and supervising architect. Once feasibility is confirmed, an official quote will be posted here for your signature.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRequestTmaModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tmaSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                >
                  {tmaSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Buyer Electronic Signing Modal for TMA Addendum */}
      {signingTma && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                  <PenTool className="w-5 h-5 text-emerald-600" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Sign Customization Addendum</h3>
                  <p className="text-xs text-slate-500 font-mono">{signingTma.reference} · Lot {lot.lotNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSigningTma(null)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {signError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{signError}</span>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Subject:</span>
                <strong className="text-slate-900">{signingTma.title}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="uppercase font-mono text-slate-700">{signingTma.category}</span>
              </div>
              {signingTma.techApproverNote && (
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                  <strong className="text-slate-800 block">Technical Validation Note:</strong>
                  {signingTma.techApproverNote}
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="font-semibold text-slate-700">Addendum Price (TTC):</span>
                <strong className="text-base font-mono font-bold text-slate-900">
                  {signingTma.priceQuote.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </strong>
              </div>
            </div>

            <form onSubmit={handleSignTma} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purchaser Full Legal Name (Electronic Signature) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full text-xs py-2.5 px-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  required
                  checked={signatureAccepted}
                  onChange={(e) => setSignatureAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="leading-relaxed">
                  I accept and validate this price quotation. I authorize the real estate developer to execute these customization works on Lot {lot.lotNumber} and incorporate this amount into my purchase contract (*Avenant aux travaux modificateurs acquéreurs*).
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSigningTma(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={signSubmitting || !signatureAccepted || !signatureName.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{signSubmitting ? 'Signing...' : 'Accept & Sign Addendum'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, User, Mail, Phone, Loader2, Search, Users, ChevronRight, Building2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AttendeeModalProps {
  meetingId: string;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'crm' | 'manual';

export default function AttendeeModal({ meetingId, workspaceId, isOpen, onClose, onSuccess }: AttendeeModalProps) {
  const { t } = useI18n();

  const ATTENDEE_TYPES = [
    { value: 'external', label: t('scheduling.attendeeModal.typeExternal') },
    { value: 'lead',     label: t('scheduling.attendeeModal.typeLead') },
    { value: 'internal', label: t('scheduling.attendeeModal.typeInternal') },
  ];

  const [mode, setMode] = useState<Mode>('crm');

  // CRM search state
  const [query,        setQuery]        = useState('');
  const [crmResults,   setCrmResults]   = useState<any[]>([]);
  const [crmLoading,   setCrmLoading]   = useState(false);
  const [selected,     setSelected]     = useState<any | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Manual / shared form state
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [type,    setType]    = useState('external');
  const [leadId,  setLeadId]  = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const reset = () => {
    setQuery(''); setCrmResults([]); setSelected(null);
    setName(''); setEmail(''); setPhone(''); setType('external'); setLeadId(undefined); setError('');
  };

  // Debounced CRM search
  const searchCrm = useCallback(async (q: string) => {
    if (!q.trim()) { setCrmResults([]); return; }
    setCrmLoading(true);
    try {
      const res = await fetch(`/api/leads/search?workspaceId=${workspaceId}&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setCrmResults(data.leads ?? data ?? []);
      }
    } finally {
      setCrmLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    const timer = setTimeout(() => searchCrm(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchCrm]);

  // When a CRM lead is selected, pre-fill form fields
  const handleSelectLead = (lead: any) => {
    setSelected(lead);
    setName(`${lead.firstName} ${lead.lastName}`.trim());
    setEmail(lead.email ?? '');
    setPhone(lead.phone ?? '');
    setType('lead');
    setLeadId(lead.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setError(t('scheduling.attendeeModal.requiredError')); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/scheduling/meetings/${meetingId}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, type, leadId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || t('scheduling.attendeeModal.addFailed'));
      }
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h3 className="text-sm font-semibold text-on-surface">{t('scheduling.attendeeModal.title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-outline-variant/10">
          <button
            type="button"
            onClick={() => { setMode('crm'); setSelected(null); }}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px capitalize transition-all ${
              mode === 'crm'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1.5 -mt-px" />
            {t('scheduling.attendeeModal.tabCrm')}
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px capitalize transition-all ${
              mode === 'manual'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <User className="w-3.5 h-3.5 inline mr-1.5 -mt-px" />
            {t('scheduling.attendeeModal.tabManual')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <p className="text-xs text-error bg-error/10 border border-error/20 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* CRM search panel */}
          {mode === 'crm' && (
            <div className="space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/50" />
                <input
                  ref={searchRef}
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelected(null); }}
                  placeholder={t('scheduling.attendeeModal.searchPlaceholder')}
                  className="w-full pl-8 pr-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                />
                {crmLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-on-surface-variant/50" />
                )}
              </div>

              {/* Results list */}
              {!selected && crmResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-outline-variant/20 divide-y divide-outline-variant/10">
                  {crmResults.map((lead: any) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => handleSelectLead(lead)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container-low text-left transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-semibold shrink-0">
                        {lead.firstName?.[0]}{lead.lastName?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-on-surface truncate">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-xs text-on-surface-variant truncate">
                          {lead.email}{lead.company ? ` · ${lead.company}` : ''}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/30 group-hover:text-on-surface-variant transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {!selected && query.trim() && !crmLoading && crmResults.length === 0 && (
                <p className="text-xs text-on-surface-variant text-center py-3">
                  {t('scheduling.attendeeModal.noResults', { query })}
                </p>
              )}

              {!selected && !query.trim() && (
                <p className="text-xs text-on-surface-variant/60 text-center py-2">
                  {t('scheduling.attendeeModal.searchPrompt')}
                </p>
              )}

              {/* Selected lead card */}
              {selected && (
                <div className="flex items-center gap-3 p-3 bg-secondary/5 border border-secondary/20 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-xs font-semibold shrink-0">
                    {selected.firstName?.[0]}{selected.lastName?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface">
                      {selected.firstName} {selected.lastName}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {selected.email}
                      {selected.company && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5">
                          <Building2 className="w-3 h-3" />{selected.company}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelected(null); setQuery(''); setName(''); setEmail(''); setPhone(''); setLeadId(undefined); }}
                    className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual form fields — always shown, but auto-filled in CRM mode after selection */}
          {(mode === 'manual' || selected) && (
            <div className="space-y-3">
              {mode === 'crm' && selected && (
                <p className="text-xs text-on-surface-variant/70">{t('scheduling.attendeeModal.reviewDetails')}</p>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  <User className="w-3.5 h-3.5 inline mr-1" />{t('scheduling.attendeeModal.nameLabel')} <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('scheduling.attendeeModal.namePlaceholder')}
                  className="w-full px-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline mr-1" />{t('scheduling.attendeeModal.emailLabel')} <span className="text-error">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('scheduling.attendeeModal.emailPlaceholder')}
                  className="w-full px-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />{t('scheduling.attendeeModal.phoneLabel')} <span className="text-on-surface-variant/40">{t('scheduling.attendeeModal.optional')}</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t('scheduling.attendeeModal.phonePlaceholder')}
                  className="w-full px-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">{t('scheduling.attendeeModal.typeLabel')}</label>
                <div className="flex gap-2">
                  {ATTENDEE_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                        type === t.value
                          ? 'border-secondary bg-secondary/10 text-secondary'
                          : 'border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { reset(); onClose(); }}
              className="flex-1 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
            >
              {t('scheduling.attendeeModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || (mode === 'crm' && !selected)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('scheduling.attendeeModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

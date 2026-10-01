'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import {
  X, Video, MapPin, Phone, Calendar, Clock, Users,
  User, ChevronDown, Plus, Trash2, Loader2, Search, UserPlus
} from 'lucide-react';
import AttendeeList from './AttendeeList';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (meeting: any) => void;
  workspaceId: string;
  leadId?: string;
  leadName?: string;
  initialData?: any;
}

const PLATFORMS = [
  { value: 'zoom',        label: 'Zoom',        icon: <img src="https://www.vectorlogo.zone/logos/zoomus/zoomus-icon.svg" className="w-5 h-5" alt="" /> },
  { value: 'google_meet', label: 'Google Meet',  icon: <img src="https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg" className="w-5 h-5" alt="" /> },
  { value: 'calcom',      label: 'Cal.com',      icon: <img src="https://cdn.simpleicons.org/cal.com/000000" className="w-4 h-4 dark:invert" alt="" /> },
  { value: 'in_person',   label: 'In-Person',    icon: <MapPin className="w-5 h-5" /> },
  { value: 'phone',       label: 'Phone Call',   icon: <Phone className="w-5 h-5" /> },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function MeetingModal({
  isOpen, onClose, onSuccess, workspaceId, leadId, leadName, initialData
}: MeetingModalProps) {
  const { t } = useI18n();
  const [activeTab,   setActiveTab]   = useState<'details' | 'attendees'>('details');
  const [title,       setTitle]       = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [platform,    setPlatform]    = useState(initialData?.platform || 'zoom');
  const [startDate,   setStartDate]   = useState('');
  const [startTime,   setStartTime]   = useState('');
  const [duration,    setDuration]    = useState(30);
  const [location,    setLocation]    = useState(initialData?.location || '');
  const [attendees,     setAttendees]     = useState<{ name: string; email: string; leadId?: string }[]>([]);
  const [newAttendee,   setNewAttendee]   = useState({ name: '', email: '' });
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState('');

  // CRM attendee search
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [showNewForm,   setShowNewForm]   = useState(false);
  const [newContact,    setNewContact]    = useState({ firstName: '', lastName: '', email: '', phone: '', company: '' });
  const [savingContact, setSavingContact] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Set default date/time to next hour
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      setStartDate(now.toISOString().split('T')[0]);
      setStartTime(now.toTimeString().slice(0, 5));
    }
  }, [isOpen]);

  const handleAddAttendee = () => {
    if (newAttendee.email.trim()) {
      setAttendees(prev => [...prev, { ...newAttendee }]);
      setNewAttendee({ name: '', email: '' });
    }
  };

  const handleRemoveAttendee = (idx: number) => {
    setAttendees(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !startTime) {
      setError('Title, date, and time are required.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const startISO = new Date(`${startDate}T${startTime}`).toISOString();
      const isEdit = Boolean(initialData?.id);

      const res = await fetch(
        isEdit ? `/api/scheduling/meetings/${initialData.id}` : '/api/scheduling/meetings',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isEdit
              ? { title, description }
              : {
                  workspaceId,
                  title,
                  description,
                  platform,
                  startTime: startISO,
                  duration,
                  location,
                  leadId,
                  attendees,
                }
          ),
        }
      );

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || (isEdit ? 'Failed to update meeting' : 'Failed to create meeting'));
      }

      const data = await res.json();
      onSuccess(data.meeting);
      onClose();
      resetForm();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setPlatform('zoom');
    setLocation(''); setAttendees([]); setError('');
    setSearchQuery(''); setSearchResults([]); setShowDropdown(false);
    setShowNewForm(false); setNewContact({ firstName: '', lastName: '', email: '', phone: '', company: '' });
  };

  // Debounced CRM search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/leads/search?workspaceId=${workspaceId}&q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.leads || []);
        setShowDropdown(true);
      } catch { /* ignore */ } finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, workspaceId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addAttendeeFromLead = (lead: any) => {
    const name = `${lead.firstName} ${lead.lastName}`.trim();
    const email = lead.email || '';
    if (attendees.some(a => a.leadId === lead.id)) return;
    setAttendees(prev => [...prev, { name, email, leadId: lead.id }]);
    setSearchQuery(''); setShowDropdown(false); setShowNewForm(false);
  };

  const handleSaveNewContact = async () => {
    if (!newContact.firstName.trim()) return;
    setSavingContact(true);
    try {
      // Find the first pipeline in the workspace to attach the lead
      const pipelineRes = await fetch(`/api/pipelines?workspaceId=${workspaceId}`);
      const pipelineData = await pipelineRes.json();
      const pipeline = Array.isArray(pipelineData) ? pipelineData[0] : pipelineData.pipelines?.[0];
      if (!pipeline) { setError('No pipeline found to save contact'); return; }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newContact,
          pipelineId: pipeline.id,
          workspaceId,
        }),
      });
      if (!res.ok) throw new Error('Failed to save contact');
      const data = await res.json();
      const lead = data.lead ?? data;
      addAttendeeFromLead(lead);
      setShowNewForm(false);
      setNewContact({ firstName: '', lastName: '', email: '', phone: '', company: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingContact(false);
    }
  };

  if (!isOpen) return null;

  const selectedPlatform = PLATFORMS.find(p => p.value === platform);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-on-surface">
              {initialData ? 'Edit Meeting' : 'Schedule Meeting'}
            </h2>
            {leadName && (
              <p className="text-xs text-on-surface-variant mt-0.5">with {leadName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs — only when editing */}
        {initialData && (
          <div className="flex items-center gap-1 px-5 pt-3 border-b border-outline-variant/10">
            {(['details', 'attendees'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px capitalize transition-all ${
                  activeTab === tab
                    ? 'border-secondary text-secondary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
        {!initialData && <div className="border-b border-outline-variant/10 mt-4" />}

        {/* Attendees tab — only when editing */}
        {initialData && activeTab === 'attendees' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            <AttendeeList
              meetingId={initialData.id}
              workspaceId={workspaceId}
              readonly={initialData.status === 'cancelled'}
            />
          </div>
        )}

        {/* Details tab / new meeting form */}
        {(!initialData || activeTab === 'details') && (
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-5 space-y-4">

            {/* Error */}
            {error && (
              <div className="text-xs text-error bg-error/10 border border-error/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Meeting title <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Discovery call with client"
                className="w-full px-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                required
              />
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Platform
              </label>
              <div className="grid grid-cols-5 gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlatform(p.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-center transition-all ${
                      platform === p.value
                        ? 'border-secondary bg-secondary/10 text-secondary'
                        : 'border-outline-variant/20 hover:border-outline-variant/50 text-on-surface-variant'
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="text-[10px] font-medium leading-tight">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  Date <span className="text-error">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  Time <span className="text-error">*</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                  required
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Duration
              </label>
              <div className="flex gap-2 flex-wrap">
                {DURATIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      duration === d
                        ? 'bg-secondary text-on-secondary'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                    }`}
                  >
                    {d < 60 ? `${d}m` : `${d / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Location (for in-person/phone) */}
            {(platform === 'in_person' || platform === 'phone') && (
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  {platform === 'phone' ? (
                    <><Phone className="w-3.5 h-3.5 inline mr-1" />{t('misc.phoneNumber')}</>
                  ) : (
                    <><MapPin className="w-3.5 h-3.5 inline mr-1" />{t('misc.locationLabel')}</>
                  )}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder={platform === 'phone' ? '+1 (555) 000-0000' : '123 Main St, City'}
                  className="w-full px-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('misc.meetingAgendaPlaceholder')}
                rows={2}
                className="w-full px-3 py-2.5 bg-surface-container-high rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all resize-none"
              />
            </div>

            {/* Attendees */}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                <Users className="w-3.5 h-3.5 inline mr-1" />
                Attendees
              </label>

              {/* Added attendees list */}
              {attendees.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {attendees.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-surface-container-high rounded-xl">
                      <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-[10px] font-semibold text-secondary flex-shrink-0">
                        {(a.name || a.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {a.name && <p className="text-xs font-medium text-on-surface truncate">{a.name}</p>}
                        {a.email && <p className="text-[11px] text-on-surface-variant truncate">{a.email}</p>}
                        {a.leadId && <p className="text-[10px] text-secondary/70 truncate">{t('misc.crmContact')}</p>}
                      </div>
                      <button type="button" onClick={() => setAttendees(prev => prev.filter((_, i) => i !== idx))} className="text-on-surface-variant hover:text-error transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search CRM contacts */}
              <div ref={searchRef} className="relative">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high rounded-xl focus-within:ring-2 focus-within:ring-secondary/50 transition-all">
                  {searchLoading ? <Loader2 className="w-3.5 h-3.5 text-on-surface-variant animate-spin flex-shrink-0" /> : <Search className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setShowNewForm(false); }}
                    onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                    placeholder={t('misc.searchCrmContacts')}
                    className="flex-1 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                  />
                </div>

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg overflow-hidden">
                    {searchResults.length > 0 ? (
                      <ul className="max-h-44 overflow-y-auto">
                        {searchResults.map(lead => (
                          <li key={lead.id}>
                            <button
                              type="button"
                              onMouseDown={() => addAttendeeFromLead(lead)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container-high text-left transition-colors"
                            >
                              <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-[10px] font-semibold text-secondary flex-shrink-0">
                                {lead.firstName[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-on-surface truncate">{lead.firstName} {lead.lastName}</p>
                                <p className="text-[11px] text-on-surface-variant truncate">{lead.email || lead.company || lead.phone}</p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-3 py-2 text-xs text-on-surface-variant">No contacts found</p>
                    )}
                    <div className="border-t border-outline-variant/10">
                      <button
                        type="button"
                        onMouseDown={() => { setShowDropdown(false); setShowNewForm(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-container-high text-left transition-colors text-secondary"
                      >
                        <UserPlus className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-xs font-medium">Create new contact &quot;{searchQuery}&quot;</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Create new contact inline form */}
              {showNewForm && (
                <div className="mt-2 p-3 border border-outline-variant/20 rounded-xl bg-surface-container-low space-y-2">
                  <p className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> New CRM Contact
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newContact.firstName}
                      onChange={e => setNewContact(p => ({ ...p, firstName: e.target.value }))}
                      placeholder={t('misc.firstNameRequired')}
                      className="px-2.5 py-1.5 bg-surface-container-high rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    />
                    <input
                      type="text"
                      value={newContact.lastName}
                      onChange={e => setNewContact(p => ({ ...p, lastName: e.target.value }))}
                      placeholder={t('misc.lastName')}
                      className="px-2.5 py-1.5 bg-surface-container-high rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    />
                  </div>
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                    placeholder={t('misc.emailLabel')}
                    className="w-full px-2.5 py-1.5 bg-surface-container-high rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newContact.phone}
                      onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                      placeholder={t('misc.phoneLabel')}
                      className="px-2.5 py-1.5 bg-surface-container-high rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    />
                    <input
                      type="text"
                      value={newContact.company}
                      onChange={e => setNewContact(p => ({ ...p, company: e.target.value }))}
                      placeholder={t('misc.companyLabel')}
                      className="px-2.5 py-1.5 bg-surface-container-high rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/50"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewForm(false)}
                      className="flex-1 text-xs py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNewContact}
                      disabled={savingContact || !newContact.firstName.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-secondary text-on-secondary hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {savingContact && <Loader2 className="w-3 h-3 animate-spin" />}
                      Save & Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex items-center gap-3 flex-shrink-0 border-t border-outline-variant/10 pt-4">
            <button
              type="button"
              onClick={() => { onClose(); resetForm(); }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-secondary text-on-secondary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {initialData ? 'Save Changes' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

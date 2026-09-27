'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Filter, Calendar, List, Clock,
  Video, RefreshCw, Loader2, CalendarX, CloudDownload
} from 'lucide-react';
import MeetingCard from './MeetingCard';
import MeetingModal from './MeetingModal';
import MeetingCalendar from './MeetingCalendar';

interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration: number;
  platform: string;
  meetingType: string;
  status: string;
  meetingUrl?: string;
  location?: string;
  attendees: any[];
  lead?: { firstName: string; lastName: string; email?: string } | null;
  user?: { name?: string; email: string } | null;
}

interface MeetingListProps {
  workspaceId: string;
  leadId?: string;
  leadName?: string;
  compact?: boolean;
}

type FilterStatus = 'all' | 'scheduled' | 'completed' | 'cancelled';
type SortMode = 'upcoming' | 'recent';
type ViewMode = 'list' | 'calendar';

export default function MeetingList({ workspaceId, leadId, leadName, compact }: MeetingListProps) {
  const [meetings,    setMeetings]    = useState<Meeting[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterStatus,setFilterStatus]= useState<FilterStatus>('all');
  const [sortMode,    setSortMode]    = useState<SortMode>('upcoming');
  const [viewMode,    setViewMode]    = useState<ViewMode>('list');
  const [showModal,   setShowModal]   = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [syncing,     setSyncing]     = useState(false);
  const [syncMsg,     setSyncMsg]     = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ workspaceId });
      if (leadId) params.set('leadId', leadId);
      const res = await fetch(`/api/scheduling/meetings?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, leadId]);

  const syncCalCom = useCallback(async () => {
    if (!workspaceId || syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/scheduling/calcom/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(`Synced ${data.synced} booking${data.synced !== 1 ? 's' : ''} from Cal.com`);
      } else if (res.status === 404) {
        // No cal.com integration — silently skip
      } else {
        setSyncMsg('Cal.com sync failed');
      }
    } catch {
      setSyncMsg('Cal.com sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }, [workspaceId, syncing]);

  // On mount: sync from Cal.com (if connected), then load from DB
  useEffect(() => {
    if (!workspaceId) return;
    // syncCalCom calls fetchMeetings internally on success.
    // We always call fetchMeetings after so the list loads even when
    // there is no Cal.com integration or when sync is skipped.
    syncCalCom().finally(() => fetchMeetings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, leadId]);

  const handleCancelMeeting = async (id: string) => {
    if (!confirm('Cancel this meeting?')) return;
    try {
      await fetch(`/api/scheduling/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      fetchMeetings();
    } catch (err) { console.error(err); }
  };

  // Filter + sort
  const filtered = meetings
    .filter(m => {
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          m.lead?.firstName?.toLowerCase().includes(q) ||
          m.lead?.lastName?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'upcoming') return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

  // Group by date
  const grouped = filtered.reduce<Record<string, Meeting[]>>((acc, m) => {
    const date = new Date(m.startTime).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(m);
    return acc;
  }, {});

  const formatGroupLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString())     return 'Today';
    if (d.toDateString() === tomorrow.toDateString())  return 'Tomorrow';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  return (
    <div className={compact ? '' : 'h-full flex flex-col'}>
      {/* Toolbar */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search meetings…"
              className="w-full pl-9 pr-3 py-2 bg-surface-container-high rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-surface-container-high rounded-xl p-1">
            {(['all','scheduled','completed','cancelled'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                  filterStatus === s
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Sort */}
          <button
            onClick={() => setSortMode(p => p === 'upcoming' ? 'recent' : 'upcoming')}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high rounded-xl text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {sortMode === 'upcoming' ? 'Upcoming first' : 'Recent first'}
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-surface-container-high rounded-xl p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
              title="Calendar view"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchMeetings}
            className="p-2 bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Cal.com sync */}
          <button
            onClick={syncCalCom}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high rounded-xl text-xs text-on-surface-variant hover:text-on-surface disabled:opacity-50 transition-colors"
            title="Sync from Cal.com"
          >
            {syncing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CloudDownload className="w-3.5 h-3.5" />}
            {syncing ? 'Syncing…' : 'Cal.com'}
          </button>
          {syncMsg && (
            <span className="text-xs text-on-surface-variant/70">{syncMsg}</span>
          )}

          {/* New meeting */}
          <button
            onClick={() => { setEditMeeting(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-on-secondary rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Schedule
          </button>
        </div>
      )}

      {/* Content */}
      <div className={`${compact ? '' : 'flex-1 overflow-y-auto custom-scrollbar'} ${viewMode === 'list' ? 'space-y-6' : ''}`}>
        {/* Calendar view */}
        {viewMode === 'calendar' && loading && (
          <div className="skeleton h-64 rounded-2xl" />
        )}
        {viewMode === 'calendar' && !loading && (
          <MeetingCalendar
            meetings={filtered}
            onMeetingClick={(m) => { setEditMeeting(m as any); setShowModal(true); }}
          />
        )}

        {/* List view */}
        {viewMode === 'list' && loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="skeleton h-36 rounded-2xl" />
            ))}
          </div>
        ) : viewMode === 'list' && Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4">
              <CalendarX className="w-8 h-8 text-secondary/60" />
            </div>
            <p className="font-semibold text-on-surface mb-1">No meetings found</p>
            <p className="text-sm text-on-surface-variant mb-4">
              {search ? 'Try adjusting your search' : 'Schedule your first meeting to get started'}
            </p>
            {!search && (
              <button
                onClick={() => { setEditMeeting(null); setShowModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Schedule Meeting
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          Object.entries(grouped).map(([dateStr, dayMeetings]) => (
            <div key={dateStr}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  {formatGroupLabel(dateStr)}
                </span>
                <div className="flex-1 h-px bg-outline-variant/20" />
                <span className="text-xs text-on-surface-variant/60">{dayMeetings.length} meeting{dayMeetings.length !== 1 ? 's' : ''}</span>
              </div>
              <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                {dayMeetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onEdit={(id) => { setEditMeeting(meetings.find(m => m.id === id) || null); setShowModal(true); }}
                    onCancel={handleCancelMeeting}
                  />
                ))}
              </div>
            </div>
          ))
        ) : null}
      </div>

      {/* Compact add btn */}
      {compact && (
        <button
          onClick={() => { setEditMeeting(null); setShowModal(true); }}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-outline-variant/40 text-xs text-on-surface-variant hover:border-secondary/50 hover:text-secondary hover:bg-secondary/5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule meeting
        </button>
      )}

      {/* Modal */}
      <MeetingModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditMeeting(null); }}
        onSuccess={() => { setShowModal(false); fetchMeetings(); }}
        workspaceId={workspaceId}
        leadId={leadId}
        leadName={leadName}
        initialData={editMeeting}
      />
    </div>
  );
}

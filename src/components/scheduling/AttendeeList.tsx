'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, CheckCircle2, XCircle, Clock, Loader2, Mail, Phone } from 'lucide-react';
import AttendeeModal from './AttendeeModal';
import { useI18n } from '@/i18n/I18nProvider';

interface Attendee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: string;
  status: string;
  joinedAt?: string;
}

interface AttendeeListProps {
  meetingId: string;
  workspaceId: string;
  /** Pass true to hide the add button (e.g. for cancelled meetings) */
  readonly?: boolean;
}

const TYPE_BADGE: Record<string, string> = {
  external: 'bg-surface-container-high text-on-surface-variant',
  internal: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  lead:     'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  contact:  'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
};

const STATUSES = ['invited', 'accepted', 'declined', 'tentative', 'attended', 'no_show'] as const;

export default function AttendeeList({ meetingId, workspaceId, readonly }: AttendeeListProps) {
  const { t } = useI18n();

  const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    invited:   { label: t('scheduling.attendee.status.invited'),   icon: Clock,         color: 'text-on-surface-variant' },
    accepted:  { label: t('scheduling.attendee.status.accepted'),  icon: CheckCircle2,  color: 'text-green-500' },
    declined:  { label: t('scheduling.attendee.status.declined'),  icon: XCircle,       color: 'text-error' },
    tentative: { label: t('scheduling.attendee.status.tentative'), icon: Clock,         color: 'text-amber-500' },
    attended:  { label: t('scheduling.attendee.status.attended'),  icon: CheckCircle2,  color: 'text-green-500' },
    no_show:   { label: t('scheduling.attendee.status.noShow'),    icon: XCircle,       color: 'text-on-surface-variant' },
  };

  const TYPE_LABEL: Record<string, string> = {
    external: t('scheduling.attendee.type.external'),
    internal: t('scheduling.attendee.type.internal'),
    lead:     t('scheduling.attendee.type.lead'),
    contact:  t('scheduling.attendee.type.contact'),
  };

  const [attendees,   setAttendees]   = useState<Attendee[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [updating,    setUpdating]    = useState<string | null>(null);
  const [openMenu,    setOpenMenu]    = useState<string | null>(null);

  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduling/meetings/${meetingId}/attendees`);
      if (res.ok) {
        const data = await res.json();
        setAttendees(data.attendees || []);
      }
    } catch (err) {
      console.error('Failed to fetch attendees:', err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { fetchAttendees(); }, [fetchAttendees]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('scheduling.attendee.removeConfirm'))) return;
    setDeleting(id);
    try {
      await fetch(`/api/scheduling/meetings/${meetingId}/attendees/${id}`, { method: 'DELETE' });
      setAttendees(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdating(id);
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/scheduling/meetings/${meetingId}/attendees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        setAttendees(prev => prev.map(a => a.id === id ? { ...a, ...data.attendee } : a));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-on-surface-variant" />
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            {t('scheduling.attendee.heading')}
          </span>
          {attendees.length > 0 && (
            <span className="px-1.5 py-0.5 bg-surface-container-high rounded-full text-[11px] font-medium text-on-surface-variant">
              {attendees.length}
            </span>
          )}
        </div>
        {!readonly && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-secondary/10 text-secondary rounded-lg text-xs font-medium hover:bg-secondary/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {t('scheduling.attendee.add')}
          </button>
        )}
      </div>

      {/* List */}
      {attendees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center mb-2">
            <Users className="w-5 h-5 text-secondary/50" />
          </div>
          <p className="text-xs text-on-surface-variant">{t('scheduling.attendee.emptyTitle')}</p>
          {!readonly && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 text-xs text-secondary hover:underline"
            >
              {t('scheduling.attendee.addFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {attendees.map(a => {
            const sc = STATUS_CONFIG[a.status] || STATUS_CONFIG['invited'];
            const StatusIcon = sc.icon;
            const typeBadge  = TYPE_BADGE[a.type] || TYPE_BADGE['external'];

            return (
              <div
                key={a.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-surface-container-lowest border border-outline-variant/15 rounded-xl group hover:border-outline-variant/30 transition-all"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-xs font-semibold text-secondary flex-shrink-0">
                  {a.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-on-surface truncate">{a.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${typeBadge}`}>
                      {TYPE_LABEL[a.type] || a.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-on-surface-variant flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" />{a.email}
                    </span>
                    {a.phone && (
                      <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />{a.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="relative flex-shrink-0">
                  {updating === a.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
                  ) : (
                    <button
                      disabled={!!readonly}
                      onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                      className={`flex items-center gap-1 text-[11px] font-medium ${sc.color} ${!readonly ? 'hover:opacity-70 cursor-pointer' : 'cursor-default'} transition-opacity`}
                      title={readonly ? sc.label : t('scheduling.attendee.changeStatusTitle')}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {sc.label}
                    </button>
                  )}

                  {/* Status dropdown */}
                  {openMenu === a.id && !readonly && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                      <div className="absolute right-0 top-6 z-20 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl py-1 min-w-[130px]">
                        {STATUSES.map(s => {
                          const sc2 = STATUS_CONFIG[s];
                          const Icon2 = sc2.icon;
                          return (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(a.id, s)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-container-high transition-colors ${
                                a.status === s ? 'font-semibold' : ''
                              } ${sc2.color}`}
                            >
                              <Icon2 className="w-3.5 h-3.5" />
                              {sc2.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Delete */}
                {!readonly && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deleting === a.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-all flex-shrink-0"
                    title={t('scheduling.attendee.removeTitle')}
                  >
                    {deleting === a.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AttendeeModal
        meetingId={meetingId}
        workspaceId={workspaceId}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchAttendees}
      />
    </div>
  );
}

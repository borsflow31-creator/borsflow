'use client';

import React from 'react';
import {
  Video, Phone, MapPin, Users, Clock, Calendar,
  ExternalLink, MoreVertical, CheckCircle2, XCircle,
  AlertCircle, Circle
} from 'lucide-react';

interface Attendee {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface MeetingCardProps {
  meeting: {
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
    attendees: Attendee[];
    lead?: { firstName: string; lastName: string; email?: string } | null;
    user?: { name?: string; email: string } | null;
  };
  onEdit?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  zoom:         { label: 'Zoom',         color: 'text-blue-700 dark:text-blue-300',  bg: 'bg-blue-50 dark:bg-blue-900/30' },
  google_meet:  { label: 'Google Meet',  color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/30' },
  calcom:       { label: 'Cal.com',      color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  in_person:    { label: 'In-Person',    color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  phone:        { label: 'Phone',        color: 'text-teal-700 dark:text-teal-300',  bg: 'bg-teal-50 dark:bg-teal-900/30' },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  scheduled:   { label: 'Scheduled',   icon: Circle,        color: 'text-secondary' },
  in_progress: { label: 'In Progress', icon: AlertCircle,   color: 'text-amber-500' },
  completed:   { label: 'Completed',   icon: CheckCircle2,  color: 'text-green-500' },
  cancelled:   { label: 'Cancelled',   icon: XCircle,       color: 'text-error' },
  no_show:     { label: 'No Show',     icon: XCircle,       color: 'text-on-surface-variant' },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function MeetingCard({ meeting, onEdit, onCancel }: MeetingCardProps) {
  const platform = PLATFORM_CONFIG[meeting.platform] || PLATFORM_CONFIG['in_person'];
  const status   = STATUS_CONFIG[meeting.status]    || STATUS_CONFIG['scheduled'];
  const StatusIcon = status.icon;

  const isPast   = new Date(meeting.endTime) < new Date();
  const isNow    = new Date(meeting.startTime) <= new Date() && new Date(meeting.endTime) >= new Date();

  return (
    <div className={`group relative bg-surface-container-lowest rounded-2xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
      isNow
        ? 'border-secondary/40 ring-2 ring-secondary/20'
        : 'border-outline-variant/20 hover:border-outline-variant/40'
    } ${isPast && meeting.status !== 'completed' ? 'opacity-70' : ''}`}>

      {/* Live badge */}
      {isNow && (
        <div className="absolute -top-2 left-4 flex items-center gap-1.5 bg-secondary text-on-secondary text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-on-secondary animate-pulse" />
          LIVE NOW
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Platform + Status row */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${platform.bg} ${platform.color}`}>
                <Video className="w-3 h-3" />
                {platform.label}
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${status.color}`}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-on-surface text-sm leading-tight truncate pr-2">
              {meeting.title}
            </h3>

            {/* Lead */}
            {meeting.lead && (
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                with {meeting.lead.firstName} {meeting.lead.lastName}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {meeting.meetingUrl && (
              <a
                href={meeting.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-secondary text-on-secondary hover:opacity-90 transition-opacity"
                title="Join meeting"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => onEdit?.(meeting.id)}
              className="p-1.5 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
              title="Options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Time & Duration */}
        <div className="flex items-center gap-3 text-[12px] text-on-surface-variant mb-3">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(meeting.startTime)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
          </span>
          <span className="text-[11px] text-on-surface-variant/60">
            {meeting.duration} min
          </span>
        </div>

        {/* Location */}
        {meeting.location && (
          <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant mb-3">
            {meeting.meetingType === 'phone' ? <Phone className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
            <span className="truncate">{meeting.location}</span>
          </div>
        )}

        {/* Attendees */}
        {meeting.attendees?.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />
            <div className="flex -space-x-1.5">
              {meeting.attendees.slice(0, 4).map((a) => (
                <div
                  key={a.id}
                  title={`${a.name} (${a.status})`}
                  className="w-6 h-6 rounded-full bg-surface-container-highest border-2 border-surface-container-lowest flex items-center justify-center text-[9px] font-semibold text-on-surface"
                >
                  {a.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              ))}
              {meeting.attendees.length > 4 && (
                <div className="w-6 h-6 rounded-full bg-secondary/10 border-2 border-surface-container-lowest flex items-center justify-center text-[9px] font-semibold text-secondary">
                  +{meeting.attendees.length - 4}
                </div>
              )}
            </div>
            <span className="text-[11px] text-on-surface-variant">
              {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Footer action strip */}
      {meeting.status === 'scheduled' && !isPast && (
        <div className="px-4 pb-3 flex items-center gap-2">
          {meeting.meetingUrl && (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium bg-secondary text-on-secondary rounded-xl hover:opacity-90 transition-opacity"
            >
              <Video className="w-3.5 h-3.5" />
              Join Meeting
            </a>
          )}
          <button
            onClick={() => onCancel?.(meeting.id)}
            className="px-3 py-1.5 text-[12px] font-medium text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

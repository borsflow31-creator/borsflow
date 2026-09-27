'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Video, Phone, MapPin } from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  platform: string;
  status: string;
  meetingUrl?: string;
  lead?: { firstName: string; lastName: string } | null;
}

interface MeetingCalendarProps {
  meetings: Meeting[];
  onMeetingClick?: (meeting: Meeting) => void;
}

const PLATFORM_COLOR: Record<string, string> = {
  zoom:         'bg-blue-500',
  google_meet:  'bg-green-500',
  calcom:       'bg-purple-500',
  in_person:    'bg-amber-500',
  phone:        'bg-teal-500',
};

const STATUS_OPACITY: Record<string, string> = {
  scheduled:   'opacity-100',
  completed:   'opacity-60',
  cancelled:   'opacity-30 line-through',
  in_progress: 'opacity-100 ring-1 ring-white',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MeetingCalendar({ meetings, onMeetingClick }: MeetingCalendarProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(today.toDateString());

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Group meetings by date string
  const byDate = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    for (const m of meetings) {
      const key = new Date(m.startTime).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    return map;
  }, [meetings]);

  const selectedMeetings = selectedDate ? (byDate[selectedDate] || []) : [];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Calendar grid */}
      <div className="flex-shrink-0 w-full lg:w-80">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-on-surface">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-on-surface-variant py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const dateStr  = new Date(year, month, day).toDateString();
            const isToday  = dateStr === today.toDateString();
            const isSelected = dateStr === selectedDate;
            const dayMeetings = byDate[dateStr] || [];

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`relative flex flex-col items-center pt-1 pb-1.5 rounded-xl transition-all text-sm ${
                  isSelected
                    ? 'bg-secondary text-on-secondary'
                    : isToday
                    ? 'bg-secondary/10 text-secondary font-bold'
                    : 'hover:bg-surface-container-high text-on-surface'
                }`}
              >
                <span className="text-xs font-medium leading-none mb-1">{day}</span>
                {/* Meeting dots */}
                <div className="flex gap-0.5 flex-wrap justify-center min-h-[6px]">
                  {dayMeetings.slice(0, 3).map(m => (
                    <span
                      key={m.id}
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        PLATFORM_COLOR[m.platform] || 'bg-secondary'
                      } ${isSelected ? 'bg-on-secondary/70' : ''}`}
                    />
                  ))}
                  {dayMeetings.length > 3 && (
                    <span className={`text-[9px] font-bold leading-none ${isSelected ? 'text-on-secondary/80' : 'text-on-surface-variant'}`}>
                      +{dayMeetings.length - 3}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
          {[
            { key: 'zoom',        label: 'Zoom' },
            { key: 'google_meet', label: 'Meet' },
            { key: 'calcom',      label: 'Cal.com' },
            { key: 'in_person',   label: 'In-Person' },
            { key: 'phone',       label: 'Phone' },
          ].map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1 text-[11px] text-on-surface-variant">
              <span className={`w-2 h-2 rounded-full ${PLATFORM_COLOR[key]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Selected day meetings */}
      <div className="flex-1 min-w-0">
        {selectedDate ? (
          <>
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
              {new Date(selectedDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              {' '}
              <span className="normal-case font-normal">
                — {selectedMeetings.length} meeting{selectedMeetings.length !== 1 ? 's' : ''}
              </span>
            </p>

            {selectedMeetings.length === 0 ? (
              <p className="text-sm text-on-surface-variant/60 py-4">No meetings on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedMeetings
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .map(m => {
                    const dot = PLATFORM_COLOR[m.platform] || 'bg-secondary';
                    const opacity = STATUS_OPACITY[m.status] || 'opacity-100';
                    return (
                      <button
                        key={m.id}
                        onClick={() => onMeetingClick?.(m)}
                        className={`w-full flex items-start gap-3 p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl hover:border-outline-variant/50 hover:shadow-sm transition-all text-left ${opacity}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface truncate">{m.title}</p>
                          {m.lead && (
                            <p className="text-[11px] text-on-surface-variant">
                              with {m.lead.firstName} {m.lead.lastName}
                            </p>
                          )}
                          <p className="text-[11px] text-on-surface-variant/60 mt-0.5">
                            {formatTime(m.startTime)} – {formatTime(m.endTime)} · {m.duration} min
                          </p>
                        </div>
                        {m.meetingUrl && (
                          <a
                            href={m.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex-shrink-0 px-2.5 py-1 bg-secondary text-on-secondary text-[11px] font-medium rounded-lg hover:opacity-90 transition-opacity"
                          >
                            Join
                          </a>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-32 text-sm text-on-surface-variant/60">
            Select a date to view meetings
          </div>
        )}
      </div>
    </div>
  );
}

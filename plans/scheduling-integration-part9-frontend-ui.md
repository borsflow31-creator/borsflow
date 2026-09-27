# Scheduling Integration Module - Frontend UI Components Design

## Overview
This document details the frontend UI components for the scheduling integration module. The components provide a seamless user experience for managing meetings, integrations, and real-time updates within the CRM system.

## UI Architecture

### Design Principles
1. **Component-Based**: Reusable, modular components
2. **Responsive**: Mobile-first design
3. **Accessible**: WCAG 2.1 AA compliant
4. **Performant**: Optimized for speed
5. **Real-Time**: Live updates via WebSocket

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **UI Library**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Real-Time**: Custom WebSocket client
- **Forms**: React Hook Form + Zod
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Component Structure

```
src/components/scheduling/
├── meetings/
│   ├── MeetingList.tsx
│   ├── MeetingCard.tsx
│   ├── MeetingModal.tsx
│   ├── MeetingCalendar.tsx
│   └── MeetingTimeline.tsx
├── integrations/
│   ├── IntegrationList.tsx
│   ├── IntegrationCard.tsx
│   ├── IntegrationModal.tsx
│   └── OAuthConnectButton.tsx
├── attendees/
│   ├── AttendeeList.tsx
│   ├── AttendeeItem.tsx
│   └── AttendeeModal.tsx
├── sync/
│   ├── SyncStatus.tsx
│   ├── SyncHistory.tsx
│   └── SyncProgress.tsx
└── common/
    ├── MeetingPlatformIcon.tsx
    ├── MeetingStatusBadge.tsx
    ├── MeetingTimeDisplay.tsx
    └── RealtimeIndicator.tsx
```

## Core Components

### 1. MeetingList Component

```typescript
// src/components/scheduling/meetings/MeetingList.tsx
'use client';

import { useState, useEffect } from 'react';
import { MeetingCard } from './MeetingCard';
import { MeetingModal } from './MeetingModal';
import { MeetingCalendar } from './MeetingCalendar';
import { ViewToggle } from '@/components/crm/ViewToggle';
import { FilterBar } from './FilterBar';

interface MeetingListProps {
  workspaceId: string;
  leadId?: string;
}

export function MeetingList({ workspaceId, leadId }: MeetingListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    platform: 'all',
    dateRange: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetings();
  }, [workspaceId, leadId, filters]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        workspaceId,
        ...(leadId && { leadId }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.platform !== 'all' && { platform: filters.platform }),
      });

      const response = await fetch(`/api/v1/meetings?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setMeetings(data.data);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = () => {
    setSelectedMeeting(null);
    setShowModal(true);
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setShowModal(true);
  };

  const handleMeetingSaved = (meeting: Meeting) => {
    if (selectedMeeting) {
      setMeetings(meetings.map(m => m.id === meeting.id ? meeting : m));
    } else {
      setMeetings([meeting, ...meetings]);
    }
    setShowModal(false);
    setSelectedMeeting(null);
  };

  const handleMeetingDeleted = (meetingId: string) => {
    setMeetings(meetings.filter(m => m.id !== meetingId));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Meetings</h2>
        <div className="flex items-center gap-4">
          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <button
            onClick={handleCreateMeeting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Meeting
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {meetings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No meetings found
            </div>
          ) : (
            meetings.map(meeting => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onEdit={() => handleEditMeeting(meeting)}
                onDelete={() => handleMeetingDeleted(meeting.id)}
              />
            ))
          )}
        </div>
      ) : (
        <MeetingCalendar
          meetings={meetings}
          onMeetingClick={handleEditMeeting}
          onCreateMeeting={handleCreateMeeting}
        />
      )}

      {/* Modal */}
      {showModal && (
        <MeetingModal
          meeting={selectedMeeting}
          workspaceId={workspaceId}
          leadId={leadId}
          onSave={handleMeetingSaved}
          onClose={() => {
            setShowModal(false);
            setSelectedMeeting(null);
          }}
        />
      )}
    </div>
  );
}
```

### 2. MeetingCard Component

```typescript
// src/components/scheduling/meetings/MeetingCard.tsx
'use client';

import { format } from 'date-fns';
import { MeetingPlatformIcon } from '../common/MeetingPlatformIcon';
import { MeetingStatusBadge } from '../common/MeetingStatusBadge';
import { MeetingTimeDisplay } from '../common/MeetingTimeDisplay';
import { MoreVertical, Video, MapPin, Users } from 'lucide-react';

interface MeetingCardProps {
  meeting: Meeting;
  onEdit: () => void;
  onDelete: () => void;
}

export function MeetingCard({ meeting, onEdit, onDelete }: MeetingCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        {/* Left Section */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <MeetingPlatformIcon platform={meeting.platform} />
            <h3 className="text-lg font-semibold">{meeting.title}</h3>
            <MeetingStatusBadge status={meeting.status} />
          </div>

          {/* Time and Location */}
          <div className="space-y-1 text-sm text-gray-600">
            <MeetingTimeDisplay
              startTime={meeting.startTime}
              endTime={meeting.endTime}
              timezone={meeting.timezone}
            />
            
            {meeting.meetingType === 'online' && meeting.meetingUrl && (
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <a
                  href={meeting.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Join Meeting
                </a>
              </div>
            )}
            
            {meeting.meetingType === 'in_person' && meeting.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{meeting.location}</span>
              </div>
            )}
          </div>

          {/* Attendees */}
          {meeting._count?.attendees > 0 && (
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{meeting._count.attendees} attendee(s)</span>
            </div>
          )}
        </div>

        {/* Right Section - Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  onEdit();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {meeting.description && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">
          {meeting.description}
        </p>
      )}
    </div>
  );
}
```

### 3. MeetingModal Component

```typescript
// src/components/scheduling/meetings/MeetingModal.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar, Clock, Video, MapPin, Users, Plus, X } from 'lucide-react';
import { MeetingPlatformIcon } from '../common/MeetingPlatformIcon';

const meetingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  timezone: z.string().default('UTC'),
  meetingType: z.enum(['in_person', 'online', 'phone']),
  location: z.string().optional(),
  platform: z.enum(['calcom', 'zoom', 'google_meet']).optional(),
  calendarIntegrationId: z.string().optional(),
  reminderEnabled: z.boolean().default(true),
  reminderTimes: z.array(z.number()).default([15, 60, 1440]),
});

type MeetingFormData = z.infer<typeof meetingSchema>;

interface MeetingModalProps {
  meeting?: Meeting | null;
  workspaceId: string;
  leadId?: string;
  onSave: (meeting: Meeting) => void;
  onClose: () => void;
}

export function MeetingModal({
  meeting,
  workspaceId,
  leadId,
  onSave,
  onClose,
}: MeetingModalProps) {
  const [loading, setLoading] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>(
    meeting?.attendees || []
  );
  const [showAttendeeForm, setShowAttendeeForm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: meeting
      ? {
          title: meeting.title,
          description: meeting.description || '',
          startTime: format(meeting.startTime, "yyyy-MM-dd'T'HH:mm"),
          endTime: format(meeting.endTime, "yyyy-MM-dd'T'HH:mm"),
          timezone: meeting.timezone,
          meetingType: meeting.meetingType,
          location: meeting.location || '',
          platform: meeting.platform,
          calendarIntegrationId: meeting.calendarIntegrationId || '',
          reminderEnabled: meeting.reminderEnabled,
          reminderTimes: meeting.reminderTimes 
            ? JSON.parse(meeting.reminderTimes) 
            : [15, 60, 1440],
        }
      : {
          startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          endTime: format(
            new Date(Date.now() + 60 * 60 * 1000),
            "yyyy-MM-dd'T'HH:mm"
          ),
          timezone: 'UTC',
          meetingType: 'online',
          platform: 'zoom',
          reminderEnabled: true,
          reminderTimes: [15, 60, 1440],
        },
  });

  const meetingType = watch('meetingType');
  const platform = watch('platform');

  const onSubmit = async (data: MeetingFormData) => {
    try {
      setLoading(true);

      const payload = {
        ...data,
        workspaceId,
        leadId,
        attendees,
      };

      const url = meeting
        ? `/api/v1/meetings/${meeting.id}`
        : '/api/v1/meetings';
      const method = meeting ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        onSave(result.data);
      } else {
        throw new Error(result.error?.message || 'Failed to save meeting');
      }
    } catch (error) {
      console.error('Error saving meeting:', error);
      alert('Failed to save meeting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addAttendee = (attendee: Omit<Attendee, 'id' | 'meetingId'>) => {
    setAttendees([...attendees, { ...attendee, id: `temp-${Date.now()}` }]);
    setShowAttendeeForm(false);
  };

  const removeAttendee = (attendeeId: string) => {
    setAttendees(attendees.filter(a => a.id !== attendeeId));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">
            {meeting ? 'Edit Meeting' : 'New Meeting'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              {...register('title')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Meeting title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              {...register('description')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Meeting description (optional)"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Time
              </label>
              <input
                {...register('startTime')}
                type="datetime-local"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.startTime && (
                <p className="mt-1 text-sm text-red-600">{errors.startTime.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                End Time
              </label>
              <input
                {...register('endTime')}
                type="datetime-local"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.endTime && (
                <p className="mt-1 text-sm text-red-600">{errors.endTime.message}</p>
              )}
            </div>
          </div>

          {/* Meeting Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Meeting Type</label>
            <div className="flex gap-3">
              {[
                { value: 'online', label: 'Online', icon: Video },
                { value: 'in_person', label: 'In Person', icon: MapPin },
                { value: 'phone', label: 'Phone', icon: Users },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('meetingType', value as any)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                    meetingType === value
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Platform Selection (for online meetings) */}
          {meetingType === 'online' && (
            <div>
              <label className="block text-sm font-medium mb-2">Platform</label>
              <div className="grid grid-cols-3 gap-3">
                {['zoom', 'google_meet', 'calcom'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setValue('platform', p as any)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                      platform === p
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <MeetingPlatformIcon platform={p as any} />
                    <span className="capitalize">{p.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location (for in-person meetings) */}
          {meetingType === 'in_person' && (
            <div>
              <label className="block text-sm font-medium mb-2">Location</label>
              <input
                {...register('location')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Meeting location"
              />
            </div>
          )}

          {/* Attendees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Attendees</label>
              <button
                type="button"
                onClick={() => setShowAttendeeForm(true)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Attendee
              </button>
            </div>

            {attendees.length > 0 ? (
              <div className="space-y-2">
                {attendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{attendee.name}</p>
                      <p className="text-sm text-gray-600">{attendee.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttendee(attendee.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No attendees added</p>
            )}

            {showAttendeeForm && (
              <AttendeeForm
                onAdd={addAttendee}
                onCancel={() => setShowAttendeeForm(false)}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : meeting ? 'Update Meeting' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 4. IntegrationList Component

```typescript
// src/components/scheduling/integrations/IntegrationList.tsx
'use client';

import { useState, useEffect } from 'react';
import { IntegrationCard } from './IntegrationCard';
import { IntegrationModal } from './IntegrationModal';
import { Plus } from 'lucide-react';

interface IntegrationListProps {
  workspaceId: string;
}

export function IntegrationList({ workspaceId }: IntegrationListProps) {
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntegrations();
  }, [workspaceId]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/v1/calendar-integrations?workspaceId=${workspaceId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setIntegrations(data.data);
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIntegrationSaved = (integration: CalendarIntegration) => {
    setIntegrations([...integrations, integration]);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Integrations</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Integration
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No integrations configured</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Add your first integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onUpdate={fetchIntegrations}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <IntegrationModal
          workspaceId={workspaceId}
          onSave={handleIntegrationSaved}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

### 5. Common Components

#### MeetingPlatformIcon
```typescript
// src/components/scheduling/common/MeetingPlatformIcon.tsx
import { Video, Calendar, Video as GoogleMeet } from 'lucide-react';

interface MeetingPlatformIconProps {
  platform: 'calcom' | 'zoom' | 'google_meet';
  className?: string;
}

export function MeetingPlatformIcon({ platform, className = 'w-5 h-5' }: MeetingPlatformIconProps) {
  const icons = {
    calcom: Calendar,
    zoom: Video,
    google_meet: GoogleMeet,
  };

  const colors = {
    calcom: 'text-blue-600',
    zoom: 'text-blue-500',
    google_meet: 'text-green-600',
  };

  const Icon = icons[platform];

  return <Icon className={`${className} ${colors[platform]}`} />;
}
```

#### MeetingStatusBadge
```typescript
// src/components/scheduling/common/MeetingStatusBadge.tsx

interface MeetingStatusBadgeProps {
  status: string;
}

export function MeetingStatusBadge({ status }: MeetingStatusBadgeProps) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-800' },
    in_progress: { label: 'In Progress', className: 'bg-green-100 text-green-800' },
    completed: { label: 'Completed', className: 'bg-gray-100 text-gray-800' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
    no_show: { label: 'No Show', className: 'bg-yellow-100 text-yellow-800' },
  };

  const config = statusConfig[status] || statusConfig.scheduled;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
```

## Page Integration

### CRM Page with Meetings Tab

```typescript
// src/app/crm/page.tsx (enhanced)
'use client';

import { useState } from 'react';
import { MeetingList } from '@/components/scheduling/meetings/MeetingList';
import { IntegrationList } from '@/components/scheduling/integrations/IntegrationList';

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<'leads' | 'meetings' | 'integrations'>('leads');
  const workspaceId = useWorkspaceId();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'leads', label: 'Leads' },
              { id: 'meetings', label: 'Meetings' },
              { id: 'integrations', label: 'Integrations' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'leads' && <LeadsView workspaceId={workspaceId} />}
        {activeTab === 'meetings' && <MeetingList workspaceId={workspaceId} />}
        {activeTab === 'integrations' && <IntegrationList workspaceId={workspaceId} />}
      </div>
    </div>
  );
}
```

## Testing Strategy

### Unit Tests
- Component rendering
- User interactions
- Form validation
- State management

### Integration Tests
- API integration
- Real-time updates
- WebSocket connections

### E2E Tests
- Complete user flows
- Cross-browser testing
- Mobile responsiveness

## Performance Optimization

### Strategies
1. **Code Splitting**: Lazy load components
2. **Memoization**: Use React.memo and useMemo
3. **Virtual Scrolling**: For large lists
4. **Image Optimization**: Next.js Image component
5. **Bundle Analysis**: Optimize bundle size

## Accessibility

### Features
1. **Keyboard Navigation**: Full keyboard support
2. **Screen Reader**: ARIA labels and roles
3. **Focus Management**: Proper focus handling
4. **Color Contrast**: WCAG AA compliant
5. **Semantic HTML**: Proper HTML structure

## Next Steps
1. Implement core components
2. Create reusable UI library
3. Set up state management
4. Implement real-time updates
5. Add error handling
6. Write comprehensive tests
7. Optimize performance
8. Ensure accessibility

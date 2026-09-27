'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import MeetingList from '@/components/scheduling/MeetingList';
import IntegrationsPanel from '@/components/scheduling/IntegrationsPanel';
import { useAppStore } from '@/store/appStore';
import { CalendarDays, Link2, BarChart3, Video } from 'lucide-react';

type ActiveTab = 'meetings' | 'integrations';

function MeetingsPageInner() {
  const searchParams        = useSearchParams();
  const workspaceId         = searchParams.get('workspace') || '';
  const { currentWorkspaceId } = useAppStore();
  const [tab, setTab]       = useState<ActiveTab>('meetings');
  const [wsName, setWsName] = useState('');

  const effectiveId = workspaceId || currentWorkspaceId || '';

  useEffect(() => {
    if (!effectiveId) return;
    fetch(`/api/workspaces/${effectiveId}`)
      .then(r => r.json())
      .then(d => setWsName(d.workspace?.name || 'Workspace'))
      .catch(() => {});
  }, [effectiveId]);

  // Handle OAuth success/error query params
  useEffect(() => {
    const success = searchParams.get('success');
    const error   = searchParams.get('error');
    if (success) {
      setTab('integrations');
      // Clear URL params without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  if (!effectiveId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-secondary/60" />
          </div>
          <h1 className="text-xl font-semibold text-on-surface mb-2">No Workspace Selected</h1>
          <p className="text-sm text-on-surface-variant">Please select a workspace from the sidebar.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'meetings',      label: 'Meetings',            icon: CalendarDays },
    { key: 'integrations',  label: 'Integrations',        icon: Link2 },
  ] as const;

  return (
    <AppShell
      workspace={{ id: effectiveId, name: wsName || 'Workspace' }}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Meetings',  href: `/meetings?workspace=${effectiveId}` },
      ]}
    >
      <div className="flex flex-col h-full">
        {/* Page header */}
        <div className="px-6 pt-6 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
                <Video className="w-6 h-6 text-secondary" />
                Meetings
              </h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Schedule and track meetings across all platforms
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-outline-variant/20">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                  tab === key
                    ? 'border-secondary text-secondary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
          {tab === 'meetings' && (
            <MeetingList workspaceId={effectiveId} />
          )}

          {tab === 'integrations' && (
            <div className="max-w-2xl">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-on-surface">Calendar & Video Integrations</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Connect your calendar and video conferencing platforms to sync meetings automatically.
                </p>
              </div>
              <IntegrationsPanel workspaceId={effectiveId} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense>
      <MeetingsPageInner />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Loader2, Link2, Unlink, RefreshCw, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { CalendarIntegrationCard, VideoConfigCard } from './IntegrationCards';
import DirectConnectModal from './DirectConnectModal';
import { useI18n } from '@/i18n/I18nProvider';

interface IntegrationsPanelProps {
  workspaceId: string;
}

const AVAILABLE_PLATFORMS = [
  { 
    key: 'google_calendar', 
    label: 'Google Calendar', 
    icon: <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-6 h-6" alt="" />, 
    desc: 'Sync meetings with Google Calendar and create Google Meet links' 
  },
  { 
    key: 'calcom',          
    label: 'Cal.com',          
    icon: <img src="https://cdn.simpleicons.org/cal.com/000000" className="w-5 h-5 dark:invert" alt="" />, 
    desc: 'Import bookings from Cal.com scheduling pages' 
  },
  { 
    key: 'zoom',            
    label: 'Zoom',             
    icon: <img src="https://www.vectorlogo.zone/logos/zoomus/zoomus-icon.svg" className="w-6 h-6" alt="" />, 
    desc: 'Create and manage Zoom meetings from the CRM' 
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Calendar',
  zoom: 'Zoom',
  calcom: 'Cal.com',
};

export default function IntegrationsPanel({ workspaceId }: IntegrationsPanelProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [calendarIntegrations, setCalendarIntegrations] = useState<any[]>([]);
  const [videoConfigs,         setVideoConfigs]         = useState<any[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [connecting,           setConnecting]           = useState<string | null>(null);
  const [syncing,              setSyncing]              = useState<string | null>(null);
  const [connectingPlatform,   setConnectingPlatform]   = useState<typeof AVAILABLE_PLATFORMS[number] | null>(null);
  const [oauthBanner,          setOauthBanner]          = useState<{ type: 'success' | 'error'; platform: string } | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduling/integrations?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarIntegrations(data.calendarIntegrations || []);
        setVideoConfigs(data.videoConfigs || []);
      }
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  // Read OAuth return params once on mount
  useEffect(() => {
    const success = searchParams.get('success');
    const error   = searchParams.get('error');
    if (success) setOauthBanner({ type: 'success', platform: success });
    else if (error) setOauthBanner({ type: 'error', platform: error });
    // Auto-dismiss after 5s
    if (success || error) {
      const t = setTimeout(() => setOauthBanner(null), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  const handleConnect = async (platformKey: string) => {
    // All platforms → one-click OAuth redirect
    setConnecting(platformKey);
    try {
      const res = await fetch('/api/scheduling/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, platform: platformKey }),
      });
      const data = await res.json();
      if (data.oauthUrl) {
        window.location.href = data.oauthUrl;
      } else {
        console.error('No OAuth URL returned', data);
        setConnecting(null);
      }
    } catch (err) {
      console.error('Connect failed:', err);
      setConnecting(null);
    }
  };

  const handleDirectConnectSuccess = () => {
    setConnectingPlatform(null);
    fetchIntegrations();
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      await fetch(`/api/scheduling/integrations/${id}/sync`, { method: 'POST' });
      await fetchIntegrations();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(null);
    }
  };

  const handleRetryWebhook = async (id: string) => {
    await fetch(`/api/scheduling/integrations/${id}/webhook`, { method: 'POST' });
    await fetchIntegrations();
  };

  const handleDisconnectCalendar = async (id: string) => {
    if (!confirm('Disconnect this calendar integration? Existing meetings will remain.')) return;
    await fetch(`/api/scheduling/integrations/${id}`, { method: 'DELETE' });
    fetchIntegrations();
  };

  const handleDisconnectVideo = async (id: string) => {
    if (!confirm('Disconnect this video platform?')) return;
    await fetch(`/api/scheduling/video-configs/${id}`, { method: 'DELETE' });
    fetchIntegrations();
  };

  const handleSetDefaultVideo = async (id: string) => {
    await fetch(`/api/scheduling/video-configs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true })
    });
    fetchIntegrations();
  };

  // Which platforms are not yet connected
  const connectedTypes = [
    ...calendarIntegrations.map(i => i.type),
    ...videoConfigs.map(v => v.platform)
  ];
  const availableToConnect = AVAILABLE_PLATFORMS.filter(p => !connectedTypes.includes(p.key));

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OAuth result banner */}
      {oauthBanner && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
          oauthBanner.type === 'success'
            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
            : 'bg-error/10 text-error'
        }`}>
          {oauthBanner.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <XCircle className="w-4 h-4 flex-shrink-0" />
          }
          {oauthBanner.type === 'success'
            ? `${PLATFORM_LABELS[oauthBanner.platform] ?? oauthBanner.platform} connected successfully!`
            : `Failed to connect ${PLATFORM_LABELS[oauthBanner.platform] ?? oauthBanner.platform}. Please try again.`
          }
        </div>
      )}

      {/* Connected calendar integrations */}
      {calendarIntegrations.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
            Calendar Integrations
          </h3>
          <div className="space-y-3">
            {calendarIntegrations.map(integration => (
              <CalendarIntegrationCard
                key={integration.id}
                integration={integration}
                onSync={handleSync}
                onDisconnect={handleDisconnectCalendar}
                onRetryWebhook={handleRetryWebhook}
                isSyncing={syncing === integration.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Connected video platforms */}
      {videoConfigs.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
            Video Conferencing
          </h3>
          <div className="space-y-3">
            {videoConfigs.map(config => (
              <VideoConfigCard
                key={config.id}
                config={config}
                onSetDefault={handleSetDefaultVideo}
                onDisconnect={handleDisconnectVideo}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available to connect */}
      {availableToConnect.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
            Connect a Platform
          </h3>
          <div className="space-y-2">
            {availableToConnect.map(platform => (
              <div
                key={platform.key}
                className="flex items-center gap-4 p-4 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl hover:border-outline-variant/40 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-xl flex-shrink-0">
                  {platform.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">{platform.label}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{platform.desc}</p>
                </div>
                <button
                  onClick={() => handleConnect(platform.key)}
                  disabled={connecting === platform.key}
                  className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-on-secondary rounded-xl text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
                >
                  {connecting === platform.key
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Link2 className="w-3.5 h-3.5" />
                  }
                  Connect
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All connected empty state */}
      {calendarIntegrations.length === 0 && videoConfigs.length === 0 && availableToConnect.length === 0 && (
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-7 h-7 text-secondary/60" />
          </div>
          <p className="text-sm font-medium text-on-surface">{t('misc.allPlatformsConnected')}</p>
          <p className="text-xs text-on-surface-variant mt-1">{t('misc.schedulingSetupComplete')}</p>
        </div>
      )}

      {/* Direct connect modal */}
      {connectingPlatform && (
        <DirectConnectModal
          platform={connectingPlatform}
          workspaceId={workspaceId}
          onSuccess={handleDirectConnectSuccess}
          onClose={() => setConnectingPlatform(null)}
        />
      )}
    </div>
  );
}

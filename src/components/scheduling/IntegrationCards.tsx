'use client';

import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, RefreshCw, Loader2,
  ExternalLink, Trash2, RotateCcw, AlertTriangle,
  Clock, Calendar, Video, History, ChevronDown, ChevronUp
} from 'lucide-react';
import SyncStatus from './SyncStatus';
import SyncHistory from './SyncHistory';
import SyncProgress from './SyncProgress';

interface CalendarIntegration {
  id: string;
  type: string;
  name: string;
  providerEmail?: string;
  lastSyncAt?: string;
  syncStatus: string;
  syncFrequency: string;
  // Cal.com booking webhook BorsFlow creates on the account when it is connected
  webhookStatus?: 'active' | 'error' | 'unsupported' | 'waiting_public_url' | null;
  webhookError?: string | null;
}

interface VideoConfig {
  id: string;
  platform: string;
  name: string;
  providerEmail?: string;
  isDefault: boolean;
}

const PLATFORM_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  google_calendar: { 
    label: 'Google Calendar', 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-white dark:bg-white/10', 
    icon: <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-6 h-6" alt="" />
  },
  calcom: { 
    label: 'Cal.com',          
    color: 'text-on-surface', 
    bg: 'bg-white dark:bg-white/10', 
    icon: <img src="https://cdn.simpleicons.org/cal.com/000000" className="w-5 h-5 dark:invert" alt="" />
  },
  zoom: { 
    label: 'Zoom',             
    color: 'text-blue-600',   
    bg: 'bg-white dark:bg-white/10', 
    icon: <img src="https://www.vectorlogo.zone/logos/zoomus/zoomus-icon.svg" className="w-6 h-6" alt="" />
  },
  google_meet: { 
    label: 'Google Meet',      
    color: 'text-green-600', 
    bg: 'bg-white dark:bg-white/10', 
    icon: <img src="https://upload.wikimedia.org/wikipedia/commons/9/9b/Google_Meet_icon_%282020%29.svg" className="w-6 h-6" alt="" />
  },
};

const SYNC_STATUS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  active:   { label: 'Active',   icon: CheckCircle2,   color: 'text-green-500' },
  error:    { label: 'Error',    icon: AlertTriangle,  color: 'text-error' },
  paused:   { label: 'Paused',   icon: Clock,          color: 'text-amber-500' },
  disabled: { label: 'Disabled', icon: XCircle,        color: 'text-on-surface-variant' },
};

// ── Calendar Integration Card ─────────────────────────────────────────────────
interface CalendarCardProps {
  integration: CalendarIntegration;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
  onRetryWebhook?: (id: string) => Promise<void> | void;
  isSyncing?: boolean;
}

/**
 * Cal.com only: whether new, moved and cancelled bookings arrive right away. The
 * webhook is created on the client's account when they connect, so this just
 * reports the outcome; hourly sync keeps meetings current either way.
 */
function LiveUpdates({ integration, onRetry }: { integration: CalendarIntegration; onRetry?: (id: string) => Promise<void> | void }) {
  const [retrying, setRetrying] = useState(false);

  if (integration.webhookStatus === 'active') {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
        Live updates on — new bookings appear right away
      </p>
    );
  }

  const canRetry = !!onRetry && integration.webhookStatus !== 'waiting_public_url';
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-on-surface-variant">
      <Clock className="w-3.5 h-3.5 mt-px flex-shrink-0" />
      <span>
        {integration.webhookError || 'Live updates are off. Bookings still sync every hour.'}
        {canRetry && (
          <button
            type="button"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              try { await onRetry!(integration.id); } finally { setRetrying(false); }
            }}
            className="ml-1.5 font-medium text-secondary hover:underline disabled:opacity-50"
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </span>
    </p>
  );
}

export function CalendarIntegrationCard({ integration, onSync, onDisconnect, onRetryWebhook, isSyncing }: CalendarCardProps) {
  const meta = PLATFORM_META[integration.type] || { label: integration.name, color: 'text-secondary', bg: 'bg-secondary/10', icon: '🔗' };
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden hover:border-outline-variant/40 transition-all">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center text-xl flex-shrink-0`}>
            {meta.icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-on-surface">{meta.label}</h3>
              <SyncStatus
                status={integration.syncStatus}
                isSyncing={isSyncing}
                compact
              />
            </div>
            {integration.providerEmail && (
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">{integration.providerEmail}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onSync(integration.id)}
              disabled={isSyncing}
              title="Sync now"
              className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors disabled:opacity-40"
            >
              {isSyncing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />
              }
            </button>
            <button
              onClick={() => setShowHistory(h => !h)}
              title="Sync history"
              className={`p-1.5 rounded-lg transition-colors ${showHistory ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDisconnect(integration.id)}
              title="Disconnect"
              className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sync progress */}
        {isSyncing && (
          <div className="mt-3">
            <SyncProgress
              integrationId={integration.id}
              isActive={!!isSyncing}
            />
          </div>
        )}

        {/* Status bar (not syncing) */}
        {!isSyncing && (
          <div className="mt-3">
            <SyncStatus
              status={integration.syncStatus}
              lastSyncAt={integration.lastSyncAt}
            />
          </div>
        )}

        {integration.type === 'calcom' && (
          <LiveUpdates integration={integration} onRetry={onRetryWebhook} />
        )}

        {/* Sync frequency badge */}
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[11px] text-on-surface-variant/60">Sync frequency:</span>
          <span className="px-2 py-0.5 bg-surface-container-high rounded-full text-[11px] font-medium text-on-surface-variant capitalize">
            {integration.syncFrequency}
          </span>
        </div>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="border-t border-outline-variant/10 p-4 bg-surface-container-low">
          <SyncHistory integrationId={integration.id} />
        </div>
      )}
    </div>
  );
}

// ── Video Config Card ─────────────────────────────────────────────────────────
interface VideoCardProps {
  config: VideoConfig;
  onSetDefault: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export function VideoConfigCard({ config, onSetDefault, onDisconnect }: VideoCardProps) {
  const meta = PLATFORM_META[config.platform] || { label: config.name, color: 'text-secondary', bg: 'bg-secondary/10', icon: '🎥' };

  return (
    <div className={`bg-surface-container-lowest rounded-2xl border transition-all p-4 hover:border-outline-variant/40 ${
      config.isDefault ? 'border-secondary/40 ring-2 ring-secondary/10' : 'border-outline-variant/20'
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center text-xl flex-shrink-0`}>
          {meta.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-on-surface">{meta.label}</h3>
            {config.isDefault && (
              <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-[11px] font-medium rounded-full">
                Default
              </span>
            )}
          </div>
          {config.providerEmail && (
            <p className="text-xs text-on-surface-variant mt-0.5 truncate">{config.providerEmail}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!config.isDefault && (
            <button
              onClick={() => onSetDefault(config.id)}
              title="Set as default"
              className="p-1.5 rounded-lg hover:bg-secondary/10 text-on-surface-variant hover:text-secondary transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDisconnect(config.id)}
            title="Disconnect"
            className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

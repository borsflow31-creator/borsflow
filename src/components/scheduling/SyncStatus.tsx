'use client';

import React from 'react';
import { CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface SyncStatusProps {
  status: string;           // 'active' | 'error' | 'paused' | 'disabled' | 'syncing'
  lastSyncAt?: string;
  isSyncing?: boolean;
  onSync?: () => void;
  compact?: boolean;
}

export default function SyncStatus({ status, lastSyncAt, isSyncing, onSync, compact }: SyncStatusProps) {
  const { t, formatDate } = useI18n();

  const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; ring: string }> = {
    active:   { label: t('scheduling.syncStatus.synced'),   icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20',   ring: 'ring-green-500/30' },
    error:    { label: t('scheduling.syncStatus.error'),    icon: AlertTriangle, color: 'text-error',                         bg: 'bg-error/10',                          ring: 'ring-error/30' },
    paused:   { label: t('scheduling.syncStatus.paused'),   icon: Clock,         color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20',    ring: 'ring-amber-500/30' },
    disabled: { label: t('scheduling.syncStatus.disabled'), icon: XCircle,       color: 'text-on-surface-variant',            bg: 'bg-surface-container-high',           ring: 'ring-outline-variant/30' },
    syncing:  { label: t('scheduling.syncStatus.syncing'),  icon: RefreshCw,     color: 'text-secondary',                     bg: 'bg-secondary/10',                     ring: 'ring-secondary/30' },
  };

  const formatLastSync = (iso?: string) => {
    if (!iso) return t('scheduling.time.never');
    const diff  = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1)   return t('scheduling.time.justNow');
    if (mins < 60)  return t('scheduling.time.minutesAgo', { count: mins });
    if (hours < 24) return t('scheduling.time.hoursAgo', { count: hours });
    return formatDate(iso, { month: 'short', day: 'numeric' });
  };

  const effectiveStatus = isSyncing ? 'syncing' : status;
  const sc = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG['disabled'];
  const StatusIcon = sc.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${sc.bg} ${sc.color} ${sc.ring}`}>
        <StatusIcon className={`w-3 h-3 ${effectiveStatus === 'syncing' ? 'animate-spin' : ''}`} />
        {sc.label}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ring-1 ${sc.bg} ${sc.ring}`}>
      {/* Icon */}
      <span className={`flex-shrink-0 ${sc.color}`}>
        <StatusIcon className={`w-5 h-5 ${effectiveStatus === 'syncing' ? 'animate-spin' : ''}`} />
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${sc.color}`}>{sc.label}</p>
        {lastSyncAt && (
          <p className="text-xs text-on-surface-variant/70 mt-0.5">
            {t('scheduling.syncStatus.lastSynced', { time: formatLastSync(lastSyncAt) })}
          </p>
        )}
        {!lastSyncAt && effectiveStatus !== 'syncing' && (
          <p className="text-xs text-on-surface-variant/70 mt-0.5">{t('scheduling.syncStatus.neverSynced')}</p>
        )}
      </div>

      {/* Sync button */}
      {onSync && effectiveStatus !== 'syncing' && (
        <button
          onClick={onSync}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:border-outline-variant/50 transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          {t('scheduling.syncStatus.syncNow')}
        </button>
      )}
      {onSync && effectiveStatus === 'syncing' && (
        <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-on-surface-variant/60">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('scheduling.syncStatus.syncing')}
        </span>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface SyncLog {
  id: string;
  operationType: string;
  status: string;
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  eventsSkipped: number;
  errorMessage?: string;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
}

interface SyncHistoryProps {
  integrationId: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  completed: { label: 'Completed', icon: CheckCircle2,  color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
  failed:    { label: 'Failed',    icon: XCircle,       color: 'text-error',                           bg: 'bg-error/10' },
  running:   { label: 'Running',   icon: RefreshCw,     color: 'text-secondary',                       bg: 'bg-secondary/10' },
  pending:   { label: 'Pending',   icon: Clock,         color: 'text-on-surface-variant',              bg: 'bg-surface-container-high' },
};

function formatDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function SyncHistory({ integrationId }: SyncHistoryProps) {
  const [logs,       setLogs]       = useState<SyncLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduling/integrations/${integrationId}/sync`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-on-surface-variant" />
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Sync History
          </span>
        </div>
        <button
          onClick={fetchLogs}
          className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <History className="w-8 h-8 text-on-surface-variant/30 mb-2" />
          <p className="text-xs text-on-surface-variant">No sync history yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG['pending'];
            const StatusIcon = sc.icon;
            const isExpanded = expanded === log.id;
            const hasStats = log.eventsProcessed > 0;

            return (
              <div
                key={log.id}
                className="border border-outline-variant/15 rounded-xl overflow-hidden"
              >
                {/* Row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container-high/50 transition-colors text-left"
                >
                  {/* Status icon */}
                  <span className={`w-7 h-7 rounded-lg ${sc.bg} flex items-center justify-center flex-shrink-0`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${sc.color} ${log.status === 'running' ? 'animate-spin' : ''}`} />
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                      <span className="text-[11px] text-on-surface-variant capitalize">
                        {log.operationType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-on-surface-variant/60">
                        {formatRelativeTime(log.startedAt)}
                      </span>
                      {log.durationMs !== undefined && (
                        <span className="text-[11px] text-on-surface-variant/60">
                          {formatDuration(log.durationMs)}
                        </span>
                      )}
                      {hasStats && (
                        <span className="text-[11px] text-on-surface-variant/60">
                          {log.eventsProcessed} events
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  {(hasStats || log.errorMessage) && (
                    isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-on-surface-variant/60 flex-shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant/60 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-outline-variant/10 pt-2.5 space-y-2">
                    {/* Stats grid */}
                    {hasStats && (
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Created', value: log.eventsCreated, color: 'text-green-600 dark:text-green-400' },
                          { label: 'Updated', value: log.eventsUpdated, color: 'text-blue-600 dark:text-blue-400' },
                          { label: 'Deleted', value: log.eventsDeleted, color: 'text-error' },
                          { label: 'Skipped', value: log.eventsSkipped, color: 'text-on-surface-variant' },
                        ].map(stat => (
                          <div key={stat.label} className="bg-surface-container-high rounded-lg px-2 py-1.5 text-center">
                            <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                            <p className="text-[10px] text-on-surface-variant/60">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error */}
                    {log.errorMessage && (
                      <div className="flex items-start gap-2 bg-error/5 border border-error/20 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-error mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-error/80 break-words">{log.errorMessage}</p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="text-[11px] text-on-surface-variant/60 space-y-0.5">
                      <p>Started: {new Date(log.startedAt).toLocaleString()}</p>
                      {log.completedAt && (
                        <p>Completed: {new Date(log.completedAt).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

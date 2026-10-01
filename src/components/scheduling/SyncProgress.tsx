'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface SyncProgressProps {
  integrationId: string;
  isActive: boolean;
  onComplete?: () => void;
}

type Phase = 'connecting' | 'fetching' | 'processing' | 'saving' | 'done' | 'error';

export default function SyncProgress({ integrationId, isActive, onComplete }: SyncProgressProps) {
  const { t } = useI18n();

  const PHASES: { key: Phase; label: string; durationMs: number }[] = [
    { key: 'connecting',  label: t('scheduling.syncProgress.connecting'),  durationMs: 600  },
    { key: 'fetching',    label: t('scheduling.syncProgress.fetching'),    durationMs: 1200 },
    { key: 'processing',  label: t('scheduling.syncProgress.processing'), durationMs: 800  },
    { key: 'saving',      label: t('scheduling.syncProgress.saving'),      durationMs: 600  },
  ];

  const [phase,     setPhase]     = useState<Phase>('connecting');
  const [phaseIdx,  setPhaseIdx]  = useState(0);
  const [error,     setError]     = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed,   setElapsed]   = useState(0);

  // Advance phases while syncing
  useEffect(() => {
    if (!isActive) { setPhase('connecting'); setPhaseIdx(0); return; }
    setStartedAt(Date.now());
    setPhase('connecting');
    setPhaseIdx(0);

    let idx = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let accumulated = 0;

    for (const p of PHASES) {
      accumulated += p.durationMs;
      const i = idx;
      timers.push(setTimeout(() => {
        setPhaseIdx(i + 1);
        setPhase(PHASES[i + 1]?.key || 'done');
      }, accumulated));
      idx++;
    }

    // Poll for actual completion
    let pollCount = 0;
    const poll = setInterval(async () => {
      pollCount++;
      if (pollCount > 30) { clearInterval(poll); return; } // 30s max
      try {
        const res  = await fetch(`/api/scheduling/integrations/${integrationId}/sync`);
        const data = await res.json();
        const latest = data.logs?.[0];
        if (latest?.status === 'completed') {
          clearInterval(poll);
          timers.forEach(clearTimeout);
          setPhase('done');
          setPhaseIdx(PHASES.length);
          setTimeout(() => onComplete?.(), 800);
        } else if (latest?.status === 'failed') {
          clearInterval(poll);
          timers.forEach(clearTimeout);
          setPhase('error');
          setError(latest.errorMessage || t('scheduling.syncProgress.failed'));
        }
      } catch (_) { /* silent */ }
    }, 1000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(poll);
    };
  }, [isActive, integrationId]);

  // Elapsed timer
  useEffect(() => {
    if (!isActive || !startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [isActive, startedAt]);

  if (!isActive) return null;

  const progress = phase === 'done'  ? 100
                 : phase === 'error' ? 100
                 : Math.round((phaseIdx / PHASES.length) * 90);

  const currentPhase = PHASES[phaseIdx] || PHASES[PHASES.length - 1];
  const label = phase === 'done'  ? t('scheduling.syncProgress.complete')
              : phase === 'error' ? (error || t('scheduling.syncProgress.failed'))
              : currentPhase.label;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        {phase === 'done' ? (
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : phase === 'error' ? (
          <XCircle className="w-4 h-4 text-error flex-shrink-0" />
        ) : (
          <RefreshCw className="w-4 h-4 text-secondary animate-spin flex-shrink-0" />
        )}
        <span className={`text-sm font-medium ${
          phase === 'done' ? 'text-green-600 dark:text-green-400'
          : phase === 'error' ? 'text-error'
          : 'text-on-surface'
        }`}>
          {label}
        </span>
        {isActive && phase !== 'done' && phase !== 'error' && (
          <span className="ml-auto text-xs text-on-surface-variant/60">{elapsed}s</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            phase === 'error' ? 'bg-error' : 'bg-secondary'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Phase steps */}
      <div className="flex items-center justify-between">
        {PHASES.map((p, i) => {
          const isDone    = phaseIdx > i;
          const isCurrent = phaseIdx === i && phase !== 'done' && phase !== 'error';
          return (
            <div key={p.key} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-2 h-2 rounded-full transition-all ${
                isDone    ? 'bg-secondary scale-100'
                : isCurrent ? 'bg-secondary/60 scale-125 animate-pulse'
                : 'bg-surface-container-highest'
              }`} />
              <span className={`text-[9px] text-center leading-tight hidden sm:block ${
                isDone || isCurrent ? 'text-on-surface-variant' : 'text-on-surface-variant/40'
              }`}>
                {p.label.replace('…', '').split(' ').slice(0, 1).join('')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

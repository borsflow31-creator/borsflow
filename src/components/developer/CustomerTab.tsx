'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, CheckCircle2, Circle, ListPlus, Loader2, Phone } from 'lucide-react';
import LeadTimeline from '@/components/crm/LeadTimeline';
import { useWorkspaceCurrency } from '@/components/developer/useWorkspaceCurrency';
import { LogCallModal, SiteVisitModal, TaskModal } from '@/components/developer/lead-actions';
import {
    Chip, LOT_STATUS_LABEL, LOT_STATUS_TONE, TMA_STATUS_LABEL, TMA_STATUS_TONE,
} from '@/components/developer/status';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { LEAD_SOURCES } from '@/lib/crm/lifecycle';
import type { ScoreBreakdown } from '@/lib/crm/lead-score';
import { localizeTaskTitle } from '@/lib/crm/task-titles';

interface Overview {
    lead: any;
    scoreBreakdown: ScoreBreakdown;
    units: any[];
    siteVisits: any[];
    tasks: any[];
    modifications: any[];
    cancellations: any[];
    counts: { files: number; calls: number; notes: number };
    totals: { contractValue: number; paid: number; due: number; overdue: number };
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">{title}</h3>
            {children}
        </section>
    );
}

/** The label for a known source, or the free text an older lead or import stored. */
const isKnownSource = (v: string): v is (typeof LEAD_SOURCES)[number] => (LEAD_SOURCES as readonly string[]).includes(v);

const personName = (p?: { name?: string | null; email?: string | null } | null) => p?.name || p?.email || '–';

/**
 * One screen for the whole relationship with a buyer: what they want, what they
 * hold and have paid, what is booked and due, and everything said to them. The
 * detail that already has a home (the full timeline) is embedded rather than
 * copied, so there is one place a note is rendered.
 */
export default function CustomerTab({
    workspaceId, leadId, leadName, onOpenFiles,
}: {
    workspaceId: string;
    leadId: string;
    leadName: string;
    onOpenFiles: () => void;
}) {
    const { t, formatNumber, formatDate, formatDateTime } = useI18n();
    const currency = useWorkspaceCurrency(workspaceId);
    const [data, setData] = useState<Overview | null>(null);
    const [failed, setFailed] = useState(false);
    const [modal, setModal] = useState<'call' | 'task' | 'visit' | null>(null);
    // Bumped after every action so the embedded timeline re-reads too.
    const [version, setVersion] = useState(0);

    const money = (n: number) => formatNumber(n, { style: 'currency', currency, maximumFractionDigits: 0 });

    const load = useCallback(async () => {
        setFailed(false);
        try {
            const res = await fetch(`/api/developer/leads/${leadId}/overview`);
            if (!res.ok) throw new Error('failed');
            setData((await res.json()).overview);
        } catch {
            setFailed(true);
        }
    }, [leadId]);

    useEffect(() => { load(); }, [load]);

    const changed = () => { setModal(null); setVersion((v) => v + 1); load(); };

    const toggleTask = async (task: any) => {
        await fetch(`/api/developer/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId, action: task.completedAt ? 'reopen' : 'complete' }),
        });
        setVersion((v) => v + 1);
        load();
    };

    if (failed) return <p className="p-6 text-sm text-on-surface-variant">{t('developerCrm.customer.loadFailed')}</p>;
    if (!data) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" /></div>;

    const { lead, units, totals } = data;
    const now = Date.now();
    const scoreWhy = (Object.entries(data.scoreBreakdown) as [keyof ScoreBreakdown, number][])
        .filter(([, points]) => points > 0)
        .map(([key, points]) => `${t(`developerCrm.lead.scoreFactor_${key}` as MessageKey)} +${points}`)
        .join(' · ');

    return (
        <div className="p-6 space-y-6">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setModal('call')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors">
                    <Phone className="h-4 w-4" />{t('developerCrm.customer.logCall')}
                </button>
                <button type="button" onClick={() => setModal('task')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors">
                    <ListPlus className="h-4 w-4" />{t('developerCrm.customer.addTask')}
                </button>
                <button type="button" onClick={() => setModal('visit')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/30 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors">
                    <CalendarPlus className="h-4 w-4" />{t('developerCrm.customer.scheduleVisit')}
                </button>
            </div>

            {/* Money */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-outline-variant/20 border border-outline-variant/20 rounded-xl overflow-hidden">
                {[
                    [t('developerCrm.customer.contractValue'), totals.contractValue, ''],
                    [t('developerCrm.customer.paid'), totals.paid, ''],
                    [t('developerCrm.customer.due'), totals.due, ''],
                    [t('developerCrm.customer.overdue'), totals.overdue, totals.overdue > 0 ? 'text-error' : ''],
                ].map(([label, value, tone]) => (
                    <div key={label as string} className="p-3 bg-surface-container-lowest">
                        <p className="text-[11px] text-on-surface-variant">{label}</p>
                        <p className={`text-lg font-semibold tabular-nums ${tone || 'text-on-surface'}`}>{money(value as number)}</p>
                    </div>
                ))}
            </div>

            {/* The brief */}
            <Block title={t('developerCrm.lead.brief')}>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                    {[
                        [t('developerCrm.lead.owner'), personName(lead.owner)],
                        [t('developerCrm.lead.project'), lead.interestedProgram?.name ?? '–'],
                        [t('developerCrm.lead.typology'), lead.interestedTypology ?? '–'],
                        [t('developerCrm.lead.budgetMin'), lead.budgetMin ? money(lead.budgetMin) : '–'],
                        [t('developerCrm.lead.budgetMax'), lead.budgetMax ? money(lead.budgetMax) : '–'],
                        [t('developerCrm.lead.location'), lead.preferredLocation ?? '–'],
                        [t('developerCrm.lead.source'), lead.source ? (isKnownSource(lead.source) ? t(`developerCrm.sources.${lead.source}` as MessageKey) : lead.source) : '–'],
                        [t('developerCrm.lead.campaign'), lead.campaign ?? '–'],
                        [t('developerCrm.lead.lastContact'), lead.lastContactedAt ? formatDate(lead.lastContactedAt) : t('developerCrm.lead.never')],
                    ].map(([label, value]) => (
                        <div key={label as string}>
                            <dt className="text-[11px] text-on-surface-variant">{label}</dt>
                            <dd className="text-on-surface truncate">{value}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-3 text-xs text-on-surface-variant" title={t('developerCrm.lead.scoreHint')}>
                    {t('developerCrm.lead.score')}: <strong className="text-on-surface tabular-nums">{lead.score}</strong>
                    {scoreWhy && <span> — {scoreWhy}</span>}
                </p>
            </Block>

            {/* Units */}
            <Block title={t('developerCrm.customer.units')}>
                {units.length === 0 ? (
                    <p className="text-sm text-on-surface-variant/70">{t('developerCrm.customer.noUnits')}</p>
                ) : (
                    <ul className="space-y-3">
                        {units.map((u) => (
                            <li key={u.id} className="border border-outline-variant/20 rounded-lg p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-on-surface">{u.program.name} · {u.lotNumber}</span>
                                    <span className="flex gap-1.5">
                                        <Chip tone="bg-surface-container-high text-on-surface-variant">
                                            {t(u.relation === 'buyer' ? 'developerCrm.customer.relationBuyer' : 'developerCrm.customer.relationOption')}
                                        </Chip>
                                        <Chip tone={LOT_STATUS_TONE[u.status] ?? LOT_STATUS_TONE.delivered}>{t(LOT_STATUS_LABEL[u.status] ?? LOT_STATUS_LABEL.available)}</Chip>
                                    </span>
                                </div>
                                <p className="text-xs text-on-surface-variant mt-1 tabular-nums">
                                    {money(u.totalPrice)}
                                    {u.payments.called > 0 && ` · ${money(u.payments.paid)} / ${money(u.payments.called)}`}
                                    {u.payments.overdue > 0 && <span className="text-error"> · {t('developerCrm.customer.unitOverdueNote', { amount: money(u.payments.overdue) })}</span>}
                                </p>
                                {u.snags.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-outline-variant/15">
                                        <p className="text-[11px] font-medium text-on-surface-variant mb-1">{t('developerCrm.customer.afterSales')}</p>
                                        <ul className="space-y-0.5">
                                            {u.snags.map((s: any) => (
                                                <li key={s.id} className="text-xs text-on-surface-variant flex justify-between gap-3">
                                                    <span className="truncate">{s.room} · {s.description}</span>
                                                    <span className="capitalize flex-shrink-0">{s.status}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Block>

            {/* Follow-ups */}
            <Block title={t('developerCrm.customer.tasks')}>
                {data.tasks.length === 0 ? (
                    <p className="text-sm text-on-surface-variant/70">{t('developerCrm.customer.noTasks')}</p>
                ) : (
                    <ul className="space-y-1">
                        {data.tasks.map((task) => {
                            const late = !task.completedAt && new Date(task.dueAt).getTime() < now;
                            return (
                                <li key={task.id} className="flex items-center gap-3 py-1.5">
                                    <button
                                        type="button"
                                        onClick={() => toggleTask(task)}
                                        aria-label={t(task.completedAt ? 'developerCrm.tasks.reopen' : 'developerCrm.tasks.complete')}
                                        className="text-on-surface-variant hover:text-secondary transition-colors flex-shrink-0"
                                    >
                                        {task.completedAt ? <CheckCircle2 className="h-5 w-5 text-secondary" /> : <Circle className="h-5 w-5" />}
                                    </button>
                                    <span className={`flex-1 min-w-0 text-sm truncate ${task.completedAt ? 'line-through text-on-surface-variant/60' : 'text-on-surface'}`}>{localizeTaskTitle(task.title, t)}</span>
                                    <span className={`text-xs tabular-nums flex-shrink-0 ${late ? 'text-error font-medium' : 'text-on-surface-variant'}`}>
                                        {late && `${t('developerCrm.lead.overdue')} · `}{formatDateTime(task.dueAt)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Block>

            {/* Site visits */}
            <Block title={t('developerCrm.customer.visits')}>
                {data.siteVisits.length === 0 ? (
                    <p className="text-sm text-on-surface-variant/70">{t('developerCrm.customer.noVisits')}</p>
                ) : (
                    <ul className="space-y-1">
                        {data.siteVisits.map((v) => (
                            <li key={v.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                                <span className="text-on-surface truncate">{v.program.name}{v.lot ? ` · ${v.lot.lotNumber}` : ''}</span>
                                <span className="text-xs text-on-surface-variant tabular-nums flex-shrink-0">
                                    {formatDateTime(v.startTime)} · {t(v.status === 'completed' ? 'developerCrm.visits.statusCompleted' : v.status === 'no_show' ? 'developerCrm.visits.statusNoShow' : v.status === 'cancelled' ? 'developerCrm.visits.statusCancelled' : 'developerCrm.visits.statusScheduled')}
                                    {v.outcome && ` · ${t(`developerCrm.visits.outcome_${v.outcome}` as MessageKey)}`}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Block>

            {data.modifications.length > 0 && (
                <Block title={t('developerCrm.customer.modifications')}>
                    <ul className="space-y-1">
                        {data.modifications.map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                                <span className="text-on-surface truncate">{m.title} <span className="text-on-surface-variant">· {m.lot.lotNumber}</span></span>
                                <Chip tone={TMA_STATUS_TONE[m.status] ?? TMA_STATUS_TONE.completed}>{t(TMA_STATUS_LABEL[m.status] ?? TMA_STATUS_LABEL.completed)}</Chip>
                            </li>
                        ))}
                    </ul>
                </Block>
            )}

            {data.cancellations.length > 0 && (
                <Block title={t('developerCrm.customer.cancellations')}>
                    <ul className="space-y-1">
                        {data.cancellations.map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                                <span className="text-on-surface truncate">{c.lot.lotNumber}{c.reason ? ` · ${c.reason}` : ''}</span>
                                <span className="text-xs text-on-surface-variant tabular-nums">{formatDate(c.cancelledAt)}</span>
                            </li>
                        ))}
                    </ul>
                </Block>
            )}

            {/* Contact history and documents */}
            <Block title={t('developerCrm.customer.activity')}>
                <p className="text-xs text-on-surface-variant mb-3">
                    {t('developerCrm.customer.callsLogged', { count: data.counts.calls })}
                    {' · '}
                    <button type="button" onClick={onOpenFiles} className="text-secondary hover:underline">
                        {t('developerCrm.customer.files')} ({data.counts.files})
                    </button>
                </p>
                <LeadTimeline key={version} leadId={leadId} workspaceId={workspaceId} />
            </Block>

            {modal === 'call' && <LogCallModal leadId={leadId} leadName={leadName} onClose={() => setModal(null)} onDone={changed} />}
            {modal === 'task' && <TaskModal workspaceId={workspaceId} lead={{ id: leadId, name: leadName }} onClose={() => setModal(null)} onDone={changed} />}
            {modal === 'visit' && <SiteVisitModal workspaceId={workspaceId} lead={{ id: leadId, name: leadName }} onClose={() => setModal(null)} onDone={changed} />}
        </div>
    );
}

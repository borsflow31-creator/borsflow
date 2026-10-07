'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { TaskModal } from '@/components/developer/lead-actions';
import { Chip } from '@/components/developer/status';
import { groupTasks } from '@/components/developer/task-groups';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { primaryButton } from '@/components/realestate/ui';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';

interface Task {
    id: string;
    type: string;
    title: string;
    dueAt: string;
    completedAt: string | null;
    lead: { id: string; firstName: string; lastName: string };
    assignee: { id: string; name: string | null; email: string } | null;
}

const DAY_MS = 86_400_000;

function TasksInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, formatDateTime } = useI18n();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState<'mine' | 'all'>('mine');
    const [showDone, setShowDone] = useState(false);
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/developer/tasks?workspaceId=${workspaceId}&scope=${scope}&status=${showDone ? 'all' : 'open'}`);
            if (!res.ok) throw new Error('failed');
            setTasks((await res.json()).tasks ?? []);
        } catch {
            setToast({ message: t('developerCrm.tasks.loadFailed'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [workspaceId, scope, showDone, t]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    const groups = useMemo(() => groupTasks(tasks), [tasks]);

    const toggle = async (task: Task) => {
        const res = await fetch(`/api/developer/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId, action: task.completedAt ? 'reopen' : 'complete' }),
        });
        if (!res.ok) setToast({ message: t('developerCrm.tasks.saveFailed'), type: 'error' });
        load();
    };

    const remove = async (task: Task) => {
        const res = await fetch(`/api/developer/tasks/${task.id}?workspaceId=${workspaceId}`, { method: 'DELETE' });
        if (!res.ok) setToast({ message: t('developerCrm.tasks.saveFailed'), type: 'error' });
        load();
    };

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    const sections: { key: keyof typeof groups; label: MessageKey; tone: string }[] = [
        { key: 'overdue', label: 'developerCrm.tasks.groupOverdue', tone: 'text-error' },
        { key: 'today', label: 'developerCrm.tasks.groupToday', tone: 'text-amber-700 dark:text-amber-400' },
        { key: 'upcoming', label: 'developerCrm.tasks.groupUpcoming', tone: 'text-on-surface' },
        { key: 'done', label: 'developerCrm.tasks.groupDone', tone: 'text-on-surface-variant' },
    ];
    const total = tasks.length;

    return (
        <AppShell>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-primary/10 text-primary rounded-lg"><ListChecks className="w-6 h-6" /></span>
                            <h1 className="text-2xl font-bold text-on-surface">{t('developerCrm.tasks.title')}</h1>
                        </div>
                        <p className="text-sm text-on-surface-variant mt-1">{t('developerCrm.tasks.subtitle')}</p>
                    </div>
                    <button onClick={() => setAdding(true)} className={`${primaryButton} inline-flex items-center gap-2`}>
                        <Plus className="w-4 h-4" />
                        {t('developerCrm.tasks.add')}
                    </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div role="tablist" className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-surface-container-low">
                        {(['mine', 'all'] as const).map((s) => (
                            <button
                                key={s}
                                role="tab"
                                aria-selected={scope === s}
                                onClick={() => setScope(s)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    scope === s ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                {t(s === 'mine' ? 'developerCrm.tasks.scopeMine' : 'developerCrm.tasks.scopeAll')}
                            </button>
                        ))}
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
                        {t('developerCrm.tasks.showDone')}
                    </label>
                </div>

                {loading && total === 0 ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : total === 0 ? (
                    <div className="p-12 text-center border border-dashed border-outline-variant/40 rounded-xl">
                        <ListChecks className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
                        <p className="text-sm text-on-surface-variant max-w-sm mx-auto">{t('developerCrm.tasks.empty')}</p>
                    </div>
                ) : (
                    <div className={`space-y-7 ${loading ? 'opacity-60' : ''}`}>
                        {sections.filter((s) => groups[s.key].length > 0).map((s) => (
                            <section key={s.key}>
                                <h2 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${s.tone}`}>
                                    {t(s.label)} <span className="tabular-nums opacity-70">· {groups[s.key].length}</span>
                                </h2>
                                <ul className="divide-y divide-outline-variant/15 border border-outline-variant/20 rounded-xl">
                                    {groups[s.key].map((task) => {
                                        const days = Math.floor((Date.now() - new Date(task.dueAt).getTime()) / DAY_MS);
                                        const buyer = `${task.lead.firstName} ${task.lead.lastName}`.trim();
                                        return (
                                            <li key={task.id} className="flex items-center gap-3 px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(task)}
                                                    aria-label={t(task.completedAt ? 'developerCrm.tasks.reopen' : 'developerCrm.tasks.complete')}
                                                    className="text-on-surface-variant hover:text-secondary transition-colors flex-shrink-0"
                                                >
                                                    {task.completedAt ? <CheckCircle2 className="h-5 w-5 text-secondary" /> : <Circle className="h-5 w-5" />}
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-sm truncate ${task.completedAt ? 'line-through text-on-surface-variant/60' : 'text-on-surface font-medium'}`}>{task.title}</p>
                                                    <p className="text-xs text-on-surface-variant truncate">
                                                        <Link
                                                            href={`/crm?workspace=${workspaceId}&lead=${task.lead.id}&tab=customer`}
                                                            className="hover:text-secondary transition-colors"
                                                        >
                                                            {buyer}
                                                        </Link>
                                                        {scope === 'all' && task.assignee && ` · ${task.assignee.name || task.assignee.email}`}
                                                    </p>
                                                </div>
                                                <Chip tone="bg-surface-container-high text-on-surface-variant">
                                                    {t(`developerCrm.taskTypes.${task.type}` as MessageKey)}
                                                </Chip>
                                                <span className={`text-xs tabular-nums whitespace-nowrap ${s.key === 'overdue' ? 'text-error font-medium' : 'text-on-surface-variant'}`}>
                                                    {formatDateTime(task.dueAt)}
                                                    {s.key === 'overdue' && days > 0 && (
                                                        <span className="block text-[11px]">{t('developerCrm.tasks.daysLate', { days })}</span>
                                                    )}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => remove(task)}
                                                    aria-label={t('developerCrm.tasks.remove')}
                                                    className="text-on-surface-variant/60 hover:text-error transition-colors flex-shrink-0"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </div>

            {adding && (
                <TaskModal
                    workspaceId={workspaceId}
                    onClose={() => setAdding(false)}
                    onDone={() => { setAdding(false); setToast({ message: t('developerCrm.tasks.newAddedFor'), type: 'success' }); load(); }}
                />
            )}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

export default function TasksPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <TasksInner />
        </Suspense>
    );
}

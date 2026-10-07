'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { Field, inputClass, primaryButton } from '@/components/realestate/ui';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import type { AlertRuleType, ParamSpec } from '@/lib/crm/alert-rules';

interface RuleView {
    type: AlertRuleType;
    enabled: boolean;
    params: Record<string, number>;
    lastFiredAt: string | null;
}

/**
 * The seven automatic alerts, each with a switch and the numbers it runs on.
 *
 * Anyone in the workspace can read this, so a salesperson can see why they were
 * pinged; only owners and admins can change it, and the server enforces that, so a
 * disabled control here is a courtesy, not the lock.
 */
function RuleCard({
    rule, limits, canEdit, onSave,
}: {
    rule: RuleView;
    limits: readonly ParamSpec[];
    canEdit: boolean;
    onSave: (type: AlertRuleType, enabled: boolean, params: Record<string, number>) => Promise<void>;
}) {
    const { t, formatDateTime } = useI18n();
    const [enabled, setEnabled] = useState(rule.enabled);
    // Held as text so a field can be empty while it is being retyped.
    const [params, setParams] = useState<Record<string, string>>(
        Object.fromEntries(Object.entries(rule.params).map(([k, v]) => [k, String(v)]))
    );
    const [saving, setSaving] = useState(false);

    // A save elsewhere (or the first load) replaces what the card shows.
    useEffect(() => {
        setEnabled(rule.enabled);
        setParams(Object.fromEntries(Object.entries(rule.params).map(([k, v]) => [k, String(v)])));
    }, [rule]);

    const dirty =
        enabled !== rule.enabled || limits.some((spec) => String(rule.params[spec.key]) !== params[spec.key]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(
                rule.type,
                enabled,
                Object.fromEntries(limits.map((spec) => [spec.key, Number(params[spec.key])]))
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="border border-outline-variant/20 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-on-surface">{t(`developerAlerts.rule_${rule.type}_title` as MessageKey)}</h2>
                    <p className="text-sm text-on-surface-variant mt-1">{t(`developerAlerts.rule_${rule.type}_desc` as MessageKey)}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-on-surface flex-shrink-0 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        disabled={!canEdit}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="h-4 w-4"
                    />
                    {t('developerAlerts.enabled')}
                </label>
            </div>

            {limits.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                    {limits.map((spec) => (
                        <Field key={spec.key} label={t(`developerAlerts.param_${spec.key}` as MessageKey)}>
                            <input
                                type="number"
                                inputMode="numeric"
                                min={spec.min}
                                max={spec.max}
                                step={1}
                                required
                                disabled={!canEdit || !enabled}
                                className={inputClass}
                                value={params[spec.key] ?? ''}
                                onChange={(e) => setParams((p) => ({ ...p, [spec.key]: e.target.value }))}
                            />
                        </Field>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-on-surface-variant">
                    {rule.lastFiredAt ? t('developerAlerts.lastFired', { date: formatDateTime(rule.lastFiredAt) }) : t('developerAlerts.neverFired')}
                </p>
                {canEdit && (
                    <button type="submit" disabled={!dirty || saving} className={`${primaryButton} inline-flex items-center gap-2`}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('developerAlerts.save')}
                    </button>
                )}
            </div>
        </form>
    );
}

function AlertsInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t } = useI18n();
    const [rules, setRules] = useState<RuleView[]>([]);
    const [limits, setLimits] = useState<Record<string, ParamSpec[]>>({});
    const [canEdit, setCanEdit] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/developer/alerts?workspaceId=${workspaceId}`);
            if (!res.ok) throw new Error('failed');
            const data = await res.json();
            setRules(data.rules ?? []);
            setLimits(data.limits ?? {});
            setCanEdit(!!data.canEdit);
        } catch {
            setToast({ message: t('developerAlerts.loadFailed'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [workspaceId, t]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    const save = async (type: AlertRuleType, enabled: boolean, params: Record<string, number>) => {
        const res = await fetch('/api/developer/alerts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId, type, enabled, params }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setToast({ message: data.error || t('developerAlerts.saveFailed'), type: 'error' });
            return;
        }
        setRules(data.rules ?? []);
        setToast({ message: t('developerAlerts.saved'), type: 'success' });
    };

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    return (
        <AppShell>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-primary/10 text-primary rounded-lg"><BellRing className="w-6 h-6" /></span>
                        <h1 className="text-2xl font-bold text-on-surface">{t('developerAlerts.title')}</h1>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-1 max-w-xl">{t('developerAlerts.subtitle')}</p>
                    {!loading && !canEdit && (
                        <p className="text-xs text-on-surface-variant/80 mt-2">{t('developerAlerts.readOnly')}</p>
                    )}
                </div>

                {loading && rules.length === 0 ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : (
                    <div className="space-y-4">
                        {rules.map((rule) => (
                            <RuleCard key={rule.type} rule={rule} limits={limits[rule.type] ?? []} canEdit={canEdit} onSave={save} />
                        ))}
                    </div>
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

export default function AlertsPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <AlertsInner />
        </Suspense>
    );
}

'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useWorkspaceCurrency } from '@/components/developer/useWorkspaceCurrency';
import PageHeader from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import Toast from '@/components/Toast';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { TEMPLATE_KINDS, placeholdersIn, renderTemplate, type TemplateKind } from '@/lib/documents/sales-merge';

type Translate = ReturnType<typeof useI18n>['t'];

/**
 * Currencies in which a flat costs millions: the sample amounts are scaled so the
 * preview reads like a real document (a 250 000 DZD flat does not exist).
 */
const SAMPLE_SCALE: Record<string, number> = { DZD: 60, MAD: 4, TND: 1.2, TRY: 30, EGP: 25 };

/**
 * Made-up figures, so the preview shows the shape of a finished document without a
 * real buyer: names and places in the reader's language, amounts in the workspace's
 * currency.
 */
function sampleFor(
    currency: string,
    kind: TemplateKind,
    t: Translate,
    formatCurrency: (amount: number, currency?: string) => string,
    formatDate: (date: Date | string | number) => string
): Record<string, string> {
    const scale = SAMPLE_SCALE[currency] ?? 1;
    const money = (n: number) => formatCurrency(Math.round(n * scale), currency);
    const vat = currency === 'DZD' ? 19 : 20;
    return {
        document_number: kind === 'contract' ? 'CON-2026-0001' : 'RES-2026-0001',
        date: formatDate('2026-10-07'),
        developer: t('templateSample.developer'),
        buyer_name: t('templateSample.buyerName'),
        buyer_email: 'buyer@example.com',
        buyer_phone: t('templateSample.buyerPhone'),
        project: t('templateSample.project'),
        project_address: t('templateSample.projectAddress'),
        unit: 'A201',
        unit_type: t('templateSample.unitType'),
        typology: 'T3',
        floor: '2',
        surface: '68',
        vat_rate: `${vat}%`,
        agent: t('templateSample.agent'),
        milestone: t('templateSample.milestone'),
        due_date: formatDate('2026-11-06'),
        portal_link: 'https://app.example.com/view/buyer/…',
        list_price: money(250000),
        discount: money(5000),
        net_price: money(245000 / (1 + vat / 100)),
        final_price: money(245000),
        reservation_fee: money(5000),
        amount_due: money(36750),
    };
}

interface Saved { id: string; programId: string | null; kind: TemplateKind; name: string; subject: string | null; body: string }
interface Defaults { name: string; subject: string | null; body: string }

function TemplatesInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t, formatCurrency, formatDate } = useI18n();
    const currency = useWorkspaceCurrency(workspaceId);

    const [saved, setSaved] = useState<Saved[]>([]);
    const [defaults, setDefaults] = useState<Record<TemplateKind, Defaults> | null>(null);
    const [fields, setFields] = useState<string[]>([]);
    const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    const [kind, setKind] = useState<TemplateKind>('reservation');
    const sample = useMemo(() => sampleFor(currency, kind, t, formatCurrency, formatDate), [currency, kind, t, formatCurrency, formatDate]);
    const [scope, setScope] = useState<string>(''); // '' = the workspace default; otherwise a project id
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const [tplRes, progRes] = await Promise.all([
                fetch(`/api/developer/sales-templates?workspaceId=${workspaceId}`),
                fetch(`/api/developer/programs?workspaceId=${workspaceId}`),
            ]);
            if (!tplRes.ok) throw new Error('failed');
            const tpl = await tplRes.json();
            setSaved(tpl.templates ?? []);
            setDefaults(tpl.defaults);
            setFields(tpl.fields ?? []);
            if (progRes.ok) setPrograms(((await progRes.json()).programs ?? []).map((p: any) => ({ id: p.id, name: p.name })));
        } catch {
            setToast({ message: t('developerSales.templates.loadFailed'), type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [workspaceId, t]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    // What the editor starts from: this scope's own template, else what it inherits
    // (the workspace's, then the built-in), so a project override begins as a copy.
    const own = saved.find((s) => s.kind === kind && (s.programId ?? '') === scope);
    const inherited = own ?? saved.find((s) => s.kind === kind && s.programId === null) ?? null;
    const source: 'own' | 'workspace' | 'builtin' = own ? 'own' : inherited ? 'workspace' : 'builtin';

    useEffect(() => {
        if (!defaults) return;
        const start = inherited ?? { name: defaults[kind].name, subject: defaults[kind].subject, body: defaults[kind].body };
        setName(start.name);
        setSubject(start.subject ?? '');
        setBody(start.body);
        // Re-seed when the scope or kind changes or a save lands, not on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, scope, defaults, saved]);

    const preview = useMemo(() => renderTemplate(body, sample), [body, sample]);
    const known = useMemo(() => new Set(fields), [fields]);
    const unknown = useMemo(() => placeholdersIn(`${subject}\n${body}`).filter((p) => !known.has(p)), [subject, body, known]);

    const insert = (field: string) => {
        const el = bodyRef.current;
        const token = `{{${field}}}`;
        if (!el) return setBody((b) => b + token);
        const { selectionStart: s, selectionEnd: e } = el;
        setBody(body.slice(0, s) + token + body.slice(e));
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/developer/sales-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, kind, programId: scope || undefined, name, subject: subject || undefined, body }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || t('developerSales.templates.saveFailed'));
            setToast({ message: t('developerSales.templates.saved'), type: 'success' });
            await load();
        } catch (err: any) {
            setToast({ message: err.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const restore = async () => {
        if (!own) return;
        const res = await fetch(`/api/developer/sales-templates/${own.id}?workspaceId=${workspaceId}`, { method: 'DELETE' });
        if (!res.ok) return setToast({ message: t('developerSales.templates.saveFailed'), type: 'error' });
        setToast({ message: t('developerSales.templates.restored'), type: 'success' });
        await load();
    };

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <PageHeader
                    icon={FileText}
                    title={t('developerSales.templates.title')}
                    subtitle={t('developerSales.templates.subtitle')}
                    guide="templates"
                />

                <div className="flex flex-wrap items-center gap-3">
                    <div role="tablist" className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-surface-container-low">
                        {TEMPLATE_KINDS.map((k) => (
                            <button
                                key={k}
                                role="tab"
                                aria-selected={kind === k}
                                onClick={() => setKind(k)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    kind === k ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                {t(`developerSales.templates.kind_${k}` as MessageKey)}
                            </button>
                        ))}
                    </div>
                    <select
                        aria-label={t('developerSales.templates.scope')}
                        className="px-2 py-1.5 rounded-lg bg-surface-container-high text-xs text-on-surface focus:outline-none"
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                    >
                        <option value="">{t('developerSales.templates.scopeWorkspace')}</option>
                        {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <span className="text-xs text-on-surface-variant">
                        {t(`developerSales.templates.source_${source}` as MessageKey)}
                    </span>
                </div>

                {loading && !defaults ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : (
                    <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Field label={t('developerSales.templates.name')}>
                                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
                            </Field>
                            {kind === 'payment_reminder' && (
                                <Field label={t('developerSales.templates.subject')}>
                                    <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
                                </Field>
                            )}
                            <Field label={t('developerSales.templates.wording')}>
                                <textarea
                                    ref={bodyRef}
                                    className={`${inputClass} font-mono text-xs`}
                                    rows={20}
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    required
                                />
                            </Field>

                            <div>
                                <p className="text-xs font-medium text-on-surface-variant mb-2">{t('developerSales.templates.placeholders')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {fields.map((f) => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => insert(f)}
                                            className="px-2 py-1 rounded bg-surface-container-high text-[11px] font-mono text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
                                        >
                                            {`{{${f}}}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {unknown.length > 0 && (
                                <p role="alert" className="text-xs text-error">
                                    {t('developerSales.templates.unknown', { fields: unknown.map((u) => `{{${u}}}`).join(', ') })}
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button type="submit" disabled={saving || unknown.length > 0} className={`${primaryButton} inline-flex items-center gap-2`}>
                                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {t('developerSales.templates.save')}
                                </button>
                                {own && (
                                    <button type="button" onClick={restore} className={secondaryButton}>
                                        {t('developerSales.templates.restore')}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-on-surface-variant mb-2">{t('developerSales.templates.preview')}</p>
                            <div className="border border-outline-variant/20 rounded-xl p-5 bg-surface-container-lowest max-h-[640px] overflow-y-auto">
                                {kind === 'payment_reminder' && subject && (
                                    <p className="text-sm font-semibold text-on-surface mb-3">{renderTemplate(subject, sample).text}</p>
                                )}
                                <pre className="whitespace-pre-wrap font-sans text-sm text-on-surface leading-relaxed">{preview.text}</pre>
                            </div>
                            <p className="text-xs text-on-surface-variant/80 mt-2">{t('developerSales.templates.previewNote')}</p>
                        </div>
                    </form>
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </AppShell>
    );
}

export default function TemplatesPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <TemplatesInner />
        </Suspense>
    );
}

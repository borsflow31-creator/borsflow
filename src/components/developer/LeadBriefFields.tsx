'use client';

import { useEffect, useState } from 'react';
import { Field, inputClass } from '@/components/realestate/ui';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { LEAD_SOURCES } from '@/lib/crm/lifecycle';

export interface LeadBriefValues {
    ownerId: string;
    source: string;
    campaign: string;
    interestedProgramId: string;
    interestedTypology: string;
    budgetMin: string;
    budgetMax: string;
    preferredLocation: string;
}

/**
 * The part of the lead form only a developer fills in: who owns the buyer, where
 * they came from, and what they are looking for. Rendered inside LeadModal's form
 * for developer accounts, so the agency form never loads any of it.
 *
 * The source is a select over the known channels rather than free text, because
 * "Facebook", "facebook" and "FB" are three rows in a report. A value an older
 * lead already carries (free text, an import) stays selectable so editing the
 * lead does not silently overwrite it.
 */
export default function LeadBriefFields({
    workspaceId, values, onChange, score, lastContactedAt, nextFollowUpAt,
}: {
    workspaceId: string;
    values: LeadBriefValues;
    onChange: (name: keyof LeadBriefValues, value: string) => void;
    /** Read-only facts about an existing lead. */
    score?: number;
    lastContactedAt?: string | null;
    nextFollowUpAt?: string | null;
}) {
    const { t, formatDate } = useI18n();
    const agents = useWorkspaceAgents(workspaceId);
    const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        fetch(`/api/developer/programs?workspaceId=${workspaceId}`)
            .then((r) => (r.ok ? r.json() : { programs: [] }))
            .then((d) => setPrograms(d.programs ?? []))
            .catch(() => {});
    }, [workspaceId]);

    const knownSource = (LEAD_SOURCES as readonly string[]).includes(values.source);
    const late = !!nextFollowUpAt && new Date(nextFollowUpAt).getTime() < Date.now();

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="headline-sm text-on-surface">{t('developerCrm.lead.brief')}</h3>
                {score !== undefined && (
                    <span
                        className="text-xs text-on-surface-variant"
                        title={t('developerCrm.lead.scoreHint')}
                    >
                        {t('developerCrm.lead.score')}: <strong className="text-on-surface tabular-nums">{score}</strong>
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('developerCrm.lead.owner')}>
                    <select className={inputClass} value={values.ownerId} onChange={(e) => onChange('ownerId', e.target.value)}>
                        <option value="">{t('developerCrm.lead.unassigned')}</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </Field>

                <Field label={t('developerCrm.lead.source')}>
                    <select className={inputClass} value={values.source} onChange={(e) => onChange('source', e.target.value)}>
                        <option value="">—</option>
                        {LEAD_SOURCES.map((s) => (
                            <option key={s} value={s}>{t(`developerCrm.sources.${s}` as MessageKey)}</option>
                        ))}
                        {values.source && !knownSource && <option value={values.source}>{values.source}</option>}
                    </select>
                </Field>

                <Field label={t('developerCrm.lead.campaign')}>
                    <input type="text" maxLength={120} className={inputClass} value={values.campaign} onChange={(e) => onChange('campaign', e.target.value)} />
                </Field>

                <Field label={t('developerCrm.lead.project')}>
                    <select className={inputClass} value={values.interestedProgramId} onChange={(e) => onChange('interestedProgramId', e.target.value)}>
                        <option value="">{t('developerCrm.lead.noProject')}</option>
                        {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </Field>

                <Field label={t('developerCrm.lead.typology')}>
                    <input type="text" maxLength={40} className={inputClass} value={values.interestedTypology} onChange={(e) => onChange('interestedTypology', e.target.value)} placeholder={t('developerCrm.lead.typologyPlaceholder')} />
                </Field>

                <Field label={t('developerCrm.lead.location')}>
                    <input type="text" maxLength={200} className={inputClass} value={values.preferredLocation} onChange={(e) => onChange('preferredLocation', e.target.value)} />
                </Field>

                {/* One budget, not two numbers to label separately. */}
                <Field label={t('developerCrm.lead.budget')}>
                    <div className="flex items-center gap-2">
                        <input
                            type="number" min={0} step={1000} className={inputClass}
                            value={values.budgetMin}
                            onChange={(e) => onChange('budgetMin', e.target.value)}
                            placeholder={t('developerCrm.lead.budgetMin')}
                            aria-label={t('developerCrm.lead.budgetMin')}
                        />
                        <span className="text-on-surface-variant" aria-hidden="true">–</span>
                        <input
                            type="number" min={0} step={1000} className={inputClass}
                            value={values.budgetMax}
                            onChange={(e) => onChange('budgetMax', e.target.value)}
                            placeholder={t('developerCrm.lead.budgetMax')}
                            aria-label={t('developerCrm.lead.budgetMax')}
                        />
                    </div>
                </Field>
            </div>

            {score !== undefined && (
                <p className="mt-3 text-xs text-on-surface-variant">
                    {t('developerCrm.lead.lastContact')}: {lastContactedAt ? formatDate(lastContactedAt) : t('developerCrm.lead.never')}
                    {' · '}
                    {t('developerCrm.lead.nextFollowUp')}:{' '}
                    {nextFollowUpAt ? (
                        <span className={late ? 'text-error font-medium' : ''}>
                            {late && `${t('developerCrm.lead.overdue')} · `}{formatDate(nextFollowUpAt)}
                        </span>
                    ) : (
                        t('developerCrm.lead.none')
                    )}
                </p>
            )}
        </div>
    );
}

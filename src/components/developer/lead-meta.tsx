'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';

/**
 * The three small facts a developer reads off a lead card or row: how warm it is,
 * who has it, and whether a follow-up is due. Shared by the board and the list so
 * they cannot disagree about what "overdue" looks like.
 */

export function ScoreBadge({ score }: { score: number }) {
    const { t } = useI18n();
    return (
        <span
            title={t('developerCrm.lead.scoreHint')}
            aria-label={`${t('developerCrm.lead.score')} ${score}`}
            className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface text-[11px] font-semibold tabular-nums"
        >
            {score}
        </span>
    );
}

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function OwnerAvatar({ ownerId, agents }: { ownerId?: string | null; agents: { id: string; name: string }[] }) {
    const { t } = useI18n();
    const name = ownerId ? agents.find((a) => a.id === ownerId)?.name : undefined;
    if (!ownerId || !name) {
        return <span className="text-[11px] text-on-surface-variant/70">{t('developerCrm.lead.unassigned')}</span>;
    }
    return (
        <span
            title={name}
            aria-label={`${t('developerCrm.lead.owner')}: ${name}`}
            className="w-6 h-6 rounded-full bg-secondary/15 text-secondary text-[11px] font-semibold inline-flex items-center justify-center"
        >
            {initials(name)}
        </span>
    );
}

/**
 * The next follow-up date. Overdue says so in words as well as colour, so it
 * reads the same to someone who cannot tell red from grey.
 */
export function FollowUpChip({ nextFollowUpAt }: { nextFollowUpAt?: string | null }) {
    const { t, locale } = useI18n();
    if (!nextFollowUpAt) return null;
    const due = new Date(nextFollowUpAt);
    const late = due.getTime() < Date.now();
    const label = due.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return (
        <span
            title={t('developerCrm.lead.nextFollowUp')}
            className={`text-[11px] tabular-nums ${late ? 'text-error font-medium' : 'text-on-surface-variant'}`}
        >
            {late ? `${t('developerCrm.lead.overdue')} · ${label}` : label}
        </span>
    );
}

export { useWorkspaceAgents };

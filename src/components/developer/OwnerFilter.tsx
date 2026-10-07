'use client';

import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/I18nProvider';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';

/** '' shows everyone's leads, 'me' the signed-in user's, anything else is a user id. */
export type OwnerFilterValue = '' | 'me' | string;

/**
 * "My leads" and an owner picker for a developer's buyer board. The toggle is the
 * common case (a salesperson looking at their own pile), so it is one click; the
 * select is for a manager looking at someone else's.
 */
export default function OwnerFilter({
    workspaceId, value, onChange,
}: {
    workspaceId: string;
    value: OwnerFilterValue;
    onChange: (value: OwnerFilterValue) => void;
}) {
    const { t } = useI18n();
    const { data: session } = useSession();
    const agents = useWorkspaceAgents(workspaceId);
    const mine = value === 'me' || (!!session?.user?.id && value === session.user.id);

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                aria-pressed={mine}
                onClick={() => onChange(mine ? '' : 'me')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mine ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
            >
                {t('developerCrm.lead.myLeads')}
            </button>
            <select
                aria-label={t('developerCrm.lead.owner')}
                className="px-2 py-1.5 rounded-lg bg-surface-container-high text-xs text-on-surface focus:outline-none"
                value={mine ? '' : value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">{t('developerCrm.lead.allOwners')}</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
        </div>
    );
}

/** Whether a lead belongs in the view for this filter. */
export function matchesOwnerFilter(
    lead: { ownerId?: string | null },
    filter: OwnerFilterValue,
    currentUserId?: string
): boolean {
    if (!filter) return true;
    const wanted = filter === 'me' ? currentUserId : filter;
    return !!wanted && lead.ownerId === wanted;
}

'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Download, Loader2, Trash2, UserCog, UserPlus } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import NoWorkspace from '@/components/NoWorkspace';
import PageSkeleton from '@/components/PageSkeleton';
import { tableClass, tdClass, thClass } from '@/components/developer/status';
import { useWorkspaceParam } from '@/components/realestate/useWorkspaceParam';
import { describeActivity } from '@/components/realestate/activity';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { relativeTime } from '@/lib/relative-time';
import type { Role } from '@/lib/workspace';
import { ACTIVITY_GROUPS, type ActivityGroup, type AuditLogEntry, type AuditLogPage, type TeamMemberRow } from '@/lib/team/audit-types';

const InviteUsersModal = dynamic(() => import('@/components/workspace/InviteUsersModal'), { ssr: false });

type Tab = 'members' | 'log';

interface MembersResponse {
    workspaceName: string;
    members: TeamMemberRow[];
    me: { userId: string; role: Role };
    canManage: boolean;
}

/** The roles an admin can hand out; the owner is fixed. */
const ASSIGNABLE: Role[] = ['admin', 'member', 'viewer'];

const ROLE_BADGE: Record<string, string> = {
    owner: 'bg-primary/10 text-primary',
    admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    member: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    viewer: 'bg-surface-container-highest text-on-surface-variant',
};

const inputClass = 'px-3 py-2 bg-surface-container-high rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50';

function initials(name: string) {
    return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function TeamInner() {
    const { workspaceId, ready } = useWorkspaceParam();
    const { t } = useI18n();
    const [tab, setTab] = useState<Tab>('members');
    const [team, setTeam] = useState<MembersResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [inviteOpen, setInviteOpen] = useState(false);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        setFailed(false);
        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/members`);
            if (!res.ok) throw new Error('failed');
            setTeam(await res.json());
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => { if (ready && workspaceId) load(); }, [ready, workspaceId, load]);

    if (!ready) return <PageSkeleton />;
    if (!workspaceId) return <AppShell><NoWorkspace /></AppShell>;

    const canManage = team?.canManage ?? false;

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <PageHeader
                    icon={UserCog}
                    title={t('team.title')}
                    subtitle={t('team.subtitle')}
                    actions={canManage ? (
                        <button
                            onClick={() => setInviteOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            <UserPlus className="h-4 w-4" />
                            {t('team.invite')}
                        </button>
                    ) : undefined}
                />

                {canManage && (
                    <div role="tablist" className="inline-flex rounded-lg border border-outline-variant/30 p-0.5 bg-surface-container-low">
                        {(['members', 'log'] as const).map((key) => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={tab === key}
                                onClick={() => setTab(key)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    tab === key ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                {t(key === 'members' ? 'team.tabMembers' : 'team.tabLog')}
                            </button>
                        ))}
                    </div>
                )}

                {failed && !team ? (
                    <p className="py-12 text-center text-sm text-on-surface-variant">
                        {t('team.loadFailed')}{' '}
                        <button onClick={load} className="text-secondary hover:underline">{t('team.retry')}</button>
                    </p>
                ) : loading && !team ? (
                    <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
                ) : team ? (
                    tab === 'log' && canManage
                        ? <ActivityLog workspaceId={workspaceId} members={team.members} />
                        : <MembersTable workspaceId={workspaceId} team={team} onChanged={load} />
                ) : null}
            </div>

            {inviteOpen && team && (
                <InviteUsersModal
                    isOpen={inviteOpen}
                    onClose={() => { setInviteOpen(false); load(); }}
                    workspaceId={workspaceId}
                    workspaceName={team.workspaceName}
                    userRole={team.me.role}
                />
            )}
        </AppShell>
    );
}

/* ─── Members ─────────────────────────────────────────────── */

function MembersTable({ workspaceId, team, onChanged }: { workspaceId: string; team: MembersResponse; onChanged: () => void }) {
    const { t, locale, formatDate } = useI18n();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');

    /** Admins may not change or remove other admins; nobody touches the owner or themselves here. */
    const editable = (m: TeamMemberRow) =>
        team.canManage && m.memberId !== null && m.userId !== team.me.userId && !(team.me.role === 'admin' && m.role === 'admin');

    const changeRole = async (m: TeamMemberRow, role: string) => {
        if (!m.memberId || role === m.role) return;
        setBusy(m.memberId);
        setError('');
        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/members/${m.memberId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '');
            onChanged();
        } catch (e) {
            setError((e as Error).message || t('team.changeFailed'));
        } finally {
            setBusy(null);
        }
    };

    const remove = async (m: TeamMemberRow) => {
        if (!m.memberId || !confirm(t('team.removeConfirm', { name: m.name }))) return;
        setBusy(m.memberId);
        setError('');
        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/members/${m.memberId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '');
            onChanged();
        } catch (e) {
            setError((e as Error).message || t('team.removeFailed'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-3">
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
            <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
                <table className={tableClass}>
                    <thead className="bg-surface-container-low">
                        <tr>
                            <th className={thClass}>{t('team.colPerson')}</th>
                            <th className={thClass}>{t('team.colRole')}</th>
                            <th className={thClass}>{t('team.colJoined')}</th>
                            <th className={thClass}>{t('team.colLastSeen')}</th>
                            {team.canManage && <th className={thClass} aria-hidden />}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/15">
                        {team.members.map((m) => (
                            <tr key={m.userId} className={busy && busy === m.memberId ? 'opacity-60' : ''}>
                                <td className={tdClass}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary/10 text-secondary text-xs font-semibold flex items-center justify-center">
                                            {initials(m.name)}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-medium text-on-surface truncate">
                                                {m.name}
                                                {m.userId === team.me.userId && <span className="ms-2 text-xs text-on-surface-variant">({t('team.you')})</span>}
                                            </div>
                                            <div className="text-xs text-on-surface-variant truncate">{m.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={tdClass}>
                                    {editable(m) ? (
                                        <select
                                            value={m.role}
                                            onChange={(e) => changeRole(m, e.target.value)}
                                            disabled={busy !== null}
                                            aria-label={t('team.colRole')}
                                            className={inputClass}
                                        >
                                            {ASSIGNABLE.map((r) => (
                                                <option key={r} value={r} title={t(`team.roleHints.${r}` as MessageKey)}>
                                                    {t(`team.roles.${r}` as MessageKey)}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[m.role] ?? ROLE_BADGE.viewer}`}>
                                            {t(`team.roles.${m.role}` as MessageKey)}
                                        </span>
                                    )}
                                </td>
                                <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                                    {formatDate(m.joinedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td className={`${tdClass} whitespace-nowrap text-on-surface-variant`}>
                                    {m.lastSignInAt ? relativeTime(m.lastSignInAt, locale) : t('team.never')}
                                </td>
                                {team.canManage && (
                                    <td className={`${tdClass} text-end`}>
                                        {editable(m) && (
                                            <button
                                                onClick={() => remove(m)}
                                                disabled={busy !== null}
                                                title={t('team.remove')}
                                                aria-label={`${t('team.remove')} ${m.name}`}
                                                className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul className="text-xs text-on-surface-variant/80 space-y-0.5">
                {ASSIGNABLE.map((r) => (
                    <li key={r}><span className="font-medium">{t(`team.roles.${r}` as MessageKey)}</span>: {t(`team.roleHints.${r}` as MessageKey)}</li>
                ))}
                {!team.canManage && <li>{t('team.readOnlyNote')}</li>}
            </ul>
        </div>
    );
}

/* ─── Activity log ────────────────────────────────────────── */

const TEAM_EVENT_KEY: Record<string, MessageKey> = {
    member_invited: 'team.events.memberInvited',
    invitation_revoked: 'team.events.invitationRevoked',
    member_joined: 'team.events.memberJoined',
    member_role_changed: 'team.events.memberRoleChanged',
    member_removed: 'team.events.memberRemoved',
    member_left: 'team.events.memberLeft',
    user_signed_in: 'team.events.signedIn',
};

function ActivityLog({ workspaceId, members }: { workspaceId: string; members: TeamMemberRow[] }) {
    const { t, locale, formatCurrency, formatDateTime } = useI18n();
    const [userId, setUserId] = useState('');
    const [group, setGroup] = useState<ActivityGroup | ''>('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

    const query = useMemo(() => {
        const q = new URLSearchParams();
        if (userId) q.set('userId', userId);
        if (group) q.set('group', group);
        if (from) q.set('from', from);
        if (to) q.set('to', to);
        return q;
    }, [userId, group, from, to]);

    const fetchPage = useCallback(async (after: string | null) => {
        setLoading(true);
        setFailed(false);
        try {
            const q = new URLSearchParams(query);
            if (after) q.set('cursor', after);
            const res = await fetch(`/api/workspaces/${workspaceId}/activity?${q}`);
            if (!res.ok) throw new Error('failed');
            const page: AuditLogPage = await res.json();
            setEntries((prev) => (after ? [...prev, ...page.entries] : page.entries));
            setCursor(page.nextCursor);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [workspaceId, query]);

    useEffect(() => { fetchPage(null); }, [fetchPage]);

    const role = (r: unknown) => (typeof r === 'string' ? t(`team.roles.${r}` as MessageKey) : '');

    const sentence = (e: AuditLogEntry): string => {
        const data = e.metadata ?? {};
        const key = TEAM_EVENT_KEY[e.type];
        if (key) {
            return t(key, {
                email: String(data.email ?? ''),
                person: String(data.name ?? data.email ?? ''),
                role: role(data.role),
                from: role(data.from),
                to: role(data.to),
            });
        }
        return describeActivity(e.type, data, t, formatCurrency) ?? e.description;
    };

    const link = (e: AuditLogEntry): string | null => {
        if (e.propertyId) return `/properties/${e.propertyId}?workspace=${workspaceId}`;
        if (e.leadId && e.type !== 'lead_deleted') return `/crm?workspace=${workspaceId}&lead=${e.leadId}`;
        return null;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
                    {t('team.filterPerson')}
                    <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass}>
                        <option value="">{t('team.allPeople')}</option>
                        {members.map((m) => (
                            <option key={m.userId} value={m.userId}>{m.name} · {t(`team.roles.${m.role}` as MessageKey)}</option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
                    {t('team.filterType')}
                    <select value={group} onChange={(e) => setGroup(e.target.value as ActivityGroup | '')} className={inputClass}>
                        <option value="">{t('team.allEvents')}</option>
                        {ACTIVITY_GROUPS.map((g) => (
                            <option key={g} value={g}>{t(`team.groups.${g}` as MessageKey)}</option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
                    {t('team.from')}
                    <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
                    {t('team.to')}
                    <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} />
                </label>
                <a
                    href={`/api/workspaces/${workspaceId}/activity?${new URLSearchParams([...query.entries(), ['format', 'csv']])}`}
                    className="ms-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/30 text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                >
                    <Download className="h-4 w-4" />
                    {t('team.exportCsv')}
                </a>
            </div>

            {failed && entries.length === 0 ? (
                <p className="py-12 text-center text-sm text-on-surface-variant">
                    {t('team.logFailed')}{' '}
                    <button onClick={() => fetchPage(null)} className="text-secondary hover:underline">{t('team.retry')}</button>
                </p>
            ) : loading && entries.length === 0 ? (
                <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" /></div>
            ) : entries.length === 0 ? (
                <p className="py-12 text-center text-sm text-on-surface-variant">{t('team.emptyLog')}</p>
            ) : (
                <ol className="border border-outline-variant/20 rounded-xl divide-y divide-outline-variant/15">
                    {entries.map((e) => {
                        const href = link(e);
                        return (
                            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary/10 text-secondary text-xs font-semibold flex items-center justify-center">
                                    {initials(e.actor.name)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm">
                                        <span className="font-medium text-on-surface">{e.actor.name}</span>
                                        <span className="ms-2 text-xs text-on-surface-variant/80" title={formatDateTime(e.createdAt)}>
                                            {relativeTime(e.createdAt, locale)}
                                        </span>
                                    </p>
                                    {/* Its own line: CRM sentences name their subject ("Jane Buyer was added"), so they cannot follow the actor's name. */}
                                    <p className="text-sm text-on-surface-variant mt-0.5">{sentence(e)}</p>
                                </div>
                                {href && (
                                    <Link href={href} className="flex-shrink-0 text-xs text-secondary hover:underline">{t('team.open')}</Link>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}

            {cursor && (
                <div className="flex justify-center">
                    <button
                        onClick={() => fetchPage(cursor)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/30 text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-50"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('team.loadMore')}
                    </button>
                </div>
            )}

            <p className="text-xs text-on-surface-variant/80">{t('team.logNote')}</p>
        </div>
    );
}

export default function TeamPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <TeamInner />
        </Suspense>
    );
}

'use client'

import React from 'react'
import { Check } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

export const TeamWorkspace = () => {
    const { t } = useI18n()

    const ROLES = [
        t('landing.team.roleViewer'),
        t('landing.team.roleMember'),
        t('landing.team.roleAdmin'),
        t('landing.team.roleOwner'),
    ] as const

    /* Mirrors the permission matrix the server actually enforces: viewers read,
       members create and edit their own, admins do everything but delete the
       workspace, owners do everything. */
    const CAPABILITIES: { label: string; from: number }[] = [
        { label: t('landing.team.capRead'), from: 0 },
        { label: t('landing.team.capCreate'), from: 1 },
        { label: t('landing.team.capEditDelete'), from: 2 },
        { label: t('landing.team.capInvite'), from: 2 },
        { label: t('landing.team.capDeleteWorkspace'), from: 3 },
    ]

    return (
        <section id="team" className="py-16 sm:py-24 scroll-mt-24 border-t border-[var(--n-border)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-text)]">
                        {t('landing.team.heading')}
                    </h2>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        {t('landing.team.lead')}
                    </p>
                </div>

                <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                    <div className="lg:col-span-7 min-w-0 w-full">
                        {/* Phone: the matrix stacks. Five columns cannot be read at
                            390px, and forcing a minimum width there widened the
                            whole document rather than scrolling inside its box. */}
                        <dl className="sm:hidden">
                            {CAPABILITIES.map(({ label, from }) => (
                                <div key={label} className="py-3.5 border-b border-[var(--n-border)]">
                                    <dt className="text-xs leading-relaxed text-[var(--n-text)]">{label}</dt>
                                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                                        {ROLES.slice(from).map((role) => (
                                            <span
                                                key={role}
                                                className="px-2 py-0.5 rounded-md text-xs bg-[var(--n-emerald-dim)] text-[var(--n-emerald)]"
                                            >
                                                {role}
                                            </span>
                                        ))}
                                    </dd>
                                </div>
                            ))}
                        </dl>

                        {/* Tablet and up: the matrix proper. */}
                        <table className="hidden sm:table w-full text-left border-collapse">
                            <caption className="sr-only">{t('landing.team.tableCaption')}</caption>
                            <thead>
                                <tr className="border-b border-[var(--n-border-strong)]">
                                    <th scope="col" className="pb-3 pr-4 text-xs font-medium text-[var(--n-text)]">
                                        {t('landing.team.permissionCol')}
                                    </th>
                                    {ROLES.map((role) => (
                                        <th
                                            key={role}
                                            scope="col"
                                            className="pb-3 px-3 text-xs font-medium text-center text-[var(--n-text)]"
                                        >
                                            {role}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {CAPABILITIES.map(({ label, from }) => (
                                    <tr key={label} className="border-b border-[var(--n-border)]">
                                        <th
                                            scope="row"
                                            className="py-3 pr-4 text-xs font-normal leading-relaxed text-[var(--n-muted)]"
                                        >
                                            {label}
                                        </th>
                                        {ROLES.map((role, i) => (
                                            <td key={role} className="py-3 px-3 text-center">
                                                {i >= from ? (
                                                    <>
                                                        <Check
                                                            className="inline-block w-3.5 h-3.5 text-[var(--n-emerald)]"
                                                            aria-hidden="true"
                                                        />
                                                        <span className="sr-only">{t('landing.team.yes')}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span aria-hidden="true" className="text-[var(--n-muted)]">
                                                            &ndash;
                                                        </span>
                                                        <span className="sr-only">{t('landing.team.no')}</span>
                                                    </>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Supporting detail */}
                    <div className="lg:col-span-5 space-y-8">
                        <div>
                            <h3 className="font-display t-h3 text-[var(--n-text)]">{t('landing.team.invitationsHeading')}</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                                {t('landing.team.invitationsBody')}
                            </p>
                        </div>

                        <div className="pt-8 border-t border-[var(--n-border)]">
                            <h3 className="font-display t-h3 text-[var(--n-text)]">{t('landing.team.talkHeading')}</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                                {t('landing.team.talkBody')}
                            </p>
                        </div>

                        <div className="pt-8 border-t border-[var(--n-border)]">
                            <h3 className="font-display t-h3 text-[var(--n-text)]">{t('landing.team.workspacesHeading')}</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                                {t('landing.team.workspacesBody')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

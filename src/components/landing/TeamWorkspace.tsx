import React from 'react'
import { Check } from 'lucide-react'

const ROLES = ['Viewer', 'Member', 'Admin', 'Owner'] as const

/* Mirrors the permission matrix the server actually enforces: viewers read,
   members create and edit their own, admins do everything but delete the
   workspace, owners do everything. */
const CAPABILITIES: { label: string; from: number }[] = [
    { label: 'Read pages, deals and invoices', from: 0 },
    { label: 'Create content and edit their own', from: 1 },
    { label: "Edit and delete anyone's content", from: 2 },
    { label: 'Invite people and manage members', from: 2 },
    { label: 'Delete the workspace', from: 3 },
]

export const TeamWorkspace = () => {
    return (
        <section id="team" className="py-16 sm:py-24 scroll-mt-24 border-t border-[var(--n-border)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-text)]">
                        Bring the team in without handing over the keys.
                    </h2>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        Four roles, enforced on the server rather than hidden in the interface. An unrecognised role falls
                        back to read-only, never to full access.
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
                            <caption className="sr-only">What each workspace role can do</caption>
                            <thead>
                                <tr className="border-b border-[var(--n-border-strong)]">
                                    <th scope="col" className="pb-3 pr-4 text-xs font-medium text-[var(--n-text)]">
                                        Permission
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
                                                        <span className="sr-only">Yes</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span aria-hidden="true" className="text-[var(--n-muted)]">
                                                            &ndash;
                                                        </span>
                                                        <span className="sr-only">No</span>
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
                            <h3 className="font-display t-h3 text-[var(--n-text)]">Invitations that arrive</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                                Invite the whole team at once, to addresses that have not registered yet. Links expire after
                                seven days and can be resent. If a provider refuses one, you still get a link to pass
                                along by hand rather than a silent failure.
                            </p>
                        </div>

                        <div className="pt-8 border-t border-[var(--n-border)]">
                            <h3 className="font-display t-h3 text-[var(--n-text)]">Talk where the work is</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                                Channels with live presence, typing indicators and file attachments, archived to your own
                                database.
                            </p>
                        </div>

                        <div className="pt-8 border-t border-[var(--n-border)]">
                            <h3 className="font-display t-h3 text-[var(--n-text)]">Run as many workspaces as you need</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                                One account, separate workspaces, separate members &mdash; for when the agency and the side
                                venture should not see each other&rsquo;s pipeline.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

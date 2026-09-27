'use client'

export interface WorkspaceMemberSummary {
    id: string
    role: string
    user: {
        id: string
        name: string | null
        email: string
    }
}

interface TopNavigationBarProps {
    workspaceName?: string
    members?: WorkspaceMemberSummary[]
}

/* Initials, not photographs: the User model has no image field, so there is no
   avatar to show for a real member. The two faces that used to sit here were
   stock images with a hardcoded "+3" beside them, which reported collaborators
   on a workspace that had none. */
const initials = (m: WorkspaceMemberSummary) => {
    const source = m.user.name?.trim() || m.user.email
    const parts = source.split(/[\s@._-]+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
}

const labelFor = (m: WorkspaceMemberSummary) => m.user.name?.trim() || m.user.email

const VISIBLE = 3

export default function TopNavigationBar({ workspaceName, members = [] }: TopNavigationBarProps) {
    const shown = members.slice(0, VISIBLE)
    const overflow = members.length - shown.length

    return (
        <header className="fixed top-0 right-0 left-16 md:left-64 h-14 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
                <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {workspaceName || 'Workspace'}
                </span>
                <div className="h-4 w-[1px] bg-outline-variant/30"></div>
                <nav className="flex space-x-4 text-sm font-medium">
                    <a className="text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 py-4" href="#">
                        Shared
                    </a>
                    <a
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-opacity py-4"
                        href="#"
                    >
                        Private
                    </a>
                </nav>
            </div>

            <div className="flex items-center space-x-6">
                {/* A workspace with only you in it has no collaborators to show. */}
                {members.length > 1 && (
                    <ul
                        className="flex -space-x-2"
                        aria-label={`${members.length} workspace members`}
                        title={members.map(labelFor).join(', ')}
                    >
                        {shown.map((m) => (
                            <li
                                key={m.id}
                                className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-950 bg-secondary text-on-secondary flex items-center justify-center text-[10px] font-bold"
                            >
                                <span className="sr-only">{labelFor(m)}</span>
                                <span aria-hidden="true">{initials(m)}</span>
                            </li>
                        ))}
                        {overflow > 0 && (
                            <li className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-950 bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
                                <span className="sr-only">{`and ${overflow} more`}</span>
                                <span aria-hidden="true">{`+${overflow}`}</span>
                            </li>
                        )}
                    </ul>
                )}

                <div className="flex items-center space-x-3">
                    <button className="px-4 py-1.5 bg-primary-container text-on-primary-container text-sm font-medium rounded transition-all hover:opacity-80">
                        Ask AI
                    </button>
                    <button className="px-4 py-1.5 bg-secondary text-white text-sm font-medium rounded transition-all hover:opacity-80">
                        Share
                    </button>
                    <div className="flex items-center space-x-2 text-slate-500">
                        <span className="material-symbols-outlined cursor-pointer hover:text-slate-900">history</span>
                        <span className="material-symbols-outlined cursor-pointer hover:text-slate-900">
                            more_horiz
                        </span>
                    </div>
                </div>
            </div>
        </header>
    )
}

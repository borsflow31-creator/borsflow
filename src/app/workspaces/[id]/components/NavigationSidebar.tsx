'use client'

export default function NavigationSidebar() {
    return (
        <aside className="h-screen w-16 md:w-64 flex flex-col fixed left-0 top-0 bg-slate-50 dark:bg-slate-900 font-sans text-sm antialiased z-50">
            <div className="flex flex-col h-full py-4 px-3 space-y-2 bg-slate-100 dark:bg-slate-800/50">
                {/* Brand Logo */}
                <div className="flex items-center px-3 mb-8">
                    <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center text-white mr-3">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: 'FILL 1' }}>
                            architecture
                        </span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-lg md:block hidden">Acme Corp</span>
                </div>

                {/* Main Tabs */}
                <nav className="flex-1 space-y-1">
                    <div className="flex items-center px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer">
                        <span className="material-symbols-outlined mr-3">search</span>
                        <span className="md:block hidden">Search</span>
                    </div>
                    <div className="flex items-center px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer">
                        <span className="material-symbols-outlined mr-3">inbox</span>
                        <span className="md:block hidden">Inbox</span>
                    </div>
                    <div className="flex items-center px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer">
                        <span className="material-symbols-outlined mr-3">task_alt</span>
                        <span className="md:block hidden">My Tasks</span>
                    </div>

                    {/* Active Workspace Tab */}
                    <div className="flex items-center px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-md border-l-2 border-indigo-500 transition-colors cursor-pointer">
                        <span className="material-symbols-outlined mr-3">grid_view</span>
                        <span className="md:block hidden">Workspace</span>
                    </div>
                </nav>

                {/* Footer Tabs */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="flex items-center px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer">
                        <span className="material-symbols-outlined mr-3 text-sm">settings</span>
                        <span className="md:block hidden">Settings</span>
                    </div>
                    <div className="flex items-center px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer">
                        <span className="material-symbols-outlined mr-3 text-sm">layers</span>
                        <span className="md:block hidden">Templates</span>
                    </div>
                    <div className="flex items-center px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer">
                        <span className="material-symbols-outlined mr-3 text-sm">delete</span>
                        <span className="md:block hidden">Trash</span>
                    </div>
                </div>
            </div>
        </aside>
    )
}

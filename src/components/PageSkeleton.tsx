/**
 * Shown by the app sections' loading.tsx the moment a nav link is clicked,
 * while the next page's code and data load. Roughly matches the AppShell frame
 * (sidebar + header + content) so the switch doesn't look like a blank screen.
 */
export default function PageSkeleton() {
    return (
        <div className="flex min-h-screen bg-background" aria-busy="true" aria-live="polite">
            <div className="hidden lg:block w-64 shrink-0 border-r border-outline-variant/20 bg-surface-container-low" />
            <div className="flex-1 min-w-0">
                <div className="h-14 border-b border-outline-variant/20 bg-surface-container-low" />
                <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
                    <div className="h-7 w-48 rounded-lg bg-surface-container-high" />
                    <div className="h-4 w-72 max-w-full rounded bg-surface-container-high" />
                    <div className="grid grid-cols-2 gap-3 pt-2 md:grid-cols-4">
                        {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-surface-container-high" />)}
                    </div>
                    <div className="h-64 rounded-lg bg-surface-container-high" />
                </div>
            </div>
        </div>
    )
}

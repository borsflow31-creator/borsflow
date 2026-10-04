export { default } from 'next-auth/middleware'

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/workspaces/:path*',
        '/crm/:path*',
        '/invoices/:path*',
        '/quotes/:path*',
        '/kanban-board-view/:path*',
        '/meetings/:path*',
        '/email-marketing/:path*',
        '/settings/:path*',
        '/pages/:path*',
        // Real estate. /products was already in the nav but missing here, so it
        // relied on API-level auth alone. /listings and /view stay public by design.
        '/properties/:path*',
        '/mandates/:path*',
        '/offers/:path*',
        '/commissions/:path*',
        '/portals/:path*',
        '/viewings/:path*',
        '/products/:path*',
    ],
}

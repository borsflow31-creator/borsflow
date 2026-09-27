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
    ],
}

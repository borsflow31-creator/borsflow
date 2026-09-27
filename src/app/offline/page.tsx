import type { Metadata } from 'next'
import RetryButton from './RetryButton'

export const metadata: Metadata = {
    title: 'Offline',
}

/*
 * PWA offline fallback (next.config.js: fallbacks.document).
 *
 * This page used to render its own <html>, <head> and <body> inside the root
 * layout, which already renders them. The nested <html> is invalid markup, so
 * React failed to hydrate it (minified error #418). It is now an ordinary page:
 * the layout provides the document and the title, and the styles are scoped to
 * a full-screen wrapper instead of <body>.
 */
export default function OfflinePage() {
    return (
        <div className="offline-root">
            <style>{`
                .offline-root {
                    position: fixed;
                    inset: 0;
                    background: #09090E;
                    color: #F0F0FF;
                    font-family: system-ui, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                }
                .offline-root .container {
                    text-align: center;
                    max-width: 400px;
                }
                .offline-root .icon {
                    width: 64px;
                    height: 64px;
                    background: #6366F1;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1.5rem;
                    font-size: 2rem;
                    font-weight: 700;
                    color: #00FFB3;
                }
                .offline-root h1 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin: 0 0 0.75rem;
                }
                .offline-root p {
                    color: #8B8BA7;
                    line-height: 1.6;
                    margin: 0 0 2rem;
                }
                .offline-root button {
                    background: #6366F1;
                    color: #fff;
                    border: none;
                    padding: 0.75rem 2rem;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    font-weight: 500;
                    cursor: pointer;
                }
                .offline-root button:hover { background: #818CF8; }
            `}</style>
            <div className="container">
                <div className="icon">B</div>
                <h1>You&apos;re offline</h1>
                <p>
                    BorsFlow needs a connection to load your workspace.
                    Check your internet and try again.
                </p>
                <RetryButton />
            </div>
        </div>
    )
}

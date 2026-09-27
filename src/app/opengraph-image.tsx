import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'BorsFlow — documents, CRM and billing on one database'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* Generated at build time rather than shipped as a binary, so the card always
   matches the live palette. Composition only: obsidian ground, one emerald
   rule, the Layers mark, and the claim. No custom face is fetched, which keeps
   the build deterministic offline. */
export default async function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: '#0a0b0e',
                    padding: '72px 80px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            background: '#f5f5f7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0a0b0e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                            <path d="m6.08 9.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59" />
                            <path d="m6.08 14.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59" />
                        </svg>
                    </div>
                    <div style={{ fontSize: 38, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.03em' }}>
                        BorsFlow
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ width: 64, height: 3, background: '#10b981', marginBottom: 34 }} />
                    <div
                        style={{
                            fontSize: 70,
                            fontWeight: 700,
                            color: '#f5f5f7',
                            lineHeight: 1.06,
                            letterSpacing: '-0.04em',
                            maxWidth: 940,
                        }}
                    >
                        Documents, CRM and billing on one database.
                    </div>
                    <div style={{ marginTop: 28, fontSize: 30, color: '#8b8f9e', lineHeight: 1.4, maxWidth: 880 }}>
                        Draft a scope, attach a quote, get it paid — without leaving the tab.
                    </div>
                </div>
            </div>
        ),
        size
    )
}

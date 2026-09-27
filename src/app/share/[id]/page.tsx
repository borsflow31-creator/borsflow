'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    ChevronRight,
    Link as LinkIcon,
    Bookmark,
    Calendar,
    Video,
    File as FileIcon,
} from 'lucide-react'

interface Block {
    id: string
    type: string
    content: any
    order: number
}

interface Page {
    id: string
    title: string
    icon: string | null
    coverImage: string | null
    isPublic: boolean
    blocks: Block[]
    workspace?: { id: string; name: string }
}

// ─── Read-only block renderers ────────────────────────────────

function ReadonlyBlock({ block, numberedIndex }: { block: Block; numberedIndex?: number }) {
    const c = block.content ?? {}
    const text: string = c.text ?? ''

    const [toggleOpen, setToggleOpen] = useState(c.isOpen ?? false)

    const colorClasses: Record<string, string> = {
        gray:   'bg-gray-50 border-gray-200',
        blue:   'bg-blue-50 border-blue-200',
        green:  'bg-green-50 border-green-200',
        yellow: 'bg-yellow-50 border-yellow-200',
        red:    'bg-red-50 border-red-200',
        purple: 'bg-purple-50 border-purple-200',
    }

    const tagColorClasses: Record<string, string> = {
        gray:   'bg-gray-100 text-gray-700',
        blue:   'bg-blue-100 text-blue-700',
        green:  'bg-green-100 text-green-700',
        yellow: 'bg-yellow-100 text-yellow-700',
        red:    'bg-red-100 text-red-700',
        purple: 'bg-purple-100 text-purple-700',
        pink:   'bg-pink-100 text-pink-700',
        orange: 'bg-orange-100 text-orange-700',
    }

    const getVideoEmbed = (url: string) => {
        const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
        if (youtubeMatch) return { platform: 'youtube', videoId: youtubeMatch[1] }
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
        if (vimeoMatch) return { platform: 'vimeo', videoId: vimeoMatch[1] }
        return null
    }

    switch (block.type) {
        case 'text':
            return <p className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap">{text}</p>

        case 'heading1':
            return <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{text}</h1>

        case 'heading2':
            return <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">{text}</h2>

        case 'heading3':
            return <h3 className="text-xl font-medium text-gray-900">{text}</h3>

        case 'bullet':
            return (
                <div className="flex items-start gap-3">
                    <span className="mt-2 text-gray-400 text-lg leading-none">•</span>
                    <p className="flex-1 text-base leading-relaxed text-gray-800">{text}</p>
                </div>
            )

        case 'numbered':
            return (
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-gray-400 text-sm font-medium min-w-[1.5rem]">{numberedIndex}.</span>
                    <p className="flex-1 text-base leading-relaxed text-gray-800">{text}</p>
                </div>
            )

        case 'todo':
            return (
                <div className="flex items-start gap-3">
                    <input
                        type="checkbox"
                        checked={c.checked ?? false}
                        readOnly
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 cursor-default"
                    />
                    <p className={`flex-1 text-base leading-relaxed ${c.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {text}
                    </p>
                </div>
            )

        case 'code':
            return (
                <div className="relative">
                    <div className="absolute top-3 right-3 px-2 py-1 bg-gray-100 rounded text-xs text-gray-500 font-mono">Code</div>
                    <pre className="w-full bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap overflow-x-auto">{text}</pre>
                </div>
            )

        case 'quote':
            return (
                <div className="border-l-4 border-gray-300 pl-4">
                    <p className="text-base leading-relaxed italic text-gray-700 whitespace-pre-wrap">{text}</p>
                </div>
            )

        case 'divider':
            return <hr className="my-4 border-gray-200" />

        case 'callout': {
            const color = c.color ?? 'gray'
            const icon = c.icon ?? '💡'
            return (
                <div className={`p-4 rounded-lg border ${colorClasses[color] ?? colorClasses.gray}`}>
                    <div className="flex items-start gap-3">
                        <span className="text-xl">{icon}</span>
                        <p className="flex-1 text-base leading-relaxed text-gray-800 whitespace-pre-wrap">{text}</p>
                    </div>
                </div>
            )
        }

        case 'toggle':
            return (
                <div>
                    <button
                        onClick={() => setToggleOpen((v: boolean) => !v)}
                        className="flex items-center gap-2 w-full text-left"
                    >
                        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${toggleOpen ? 'rotate-90' : ''}`} />
                        <span className="text-base font-medium text-gray-900">{c.toggleTitle ?? ''}</span>
                    </button>
                    {toggleOpen && (
                        <p className="mt-2 ml-6 text-base leading-relaxed text-gray-700 whitespace-pre-wrap">
                            {c.toggleContent ?? ''}
                        </p>
                    )}
                </div>
            )

        case 'image':
            return c.url ? (
                <figure>
                    <img src={c.url} alt={c.caption ?? ''} className="rounded-lg max-w-full" />
                    {c.caption && <figcaption className="mt-2 text-sm text-gray-500 text-center">{c.caption}</figcaption>}
                </figure>
            ) : null

        case 'table': {
            const headers: string[] = c.headers ?? []
            const rows: string[][] = c.rows ?? []
            if (!headers.length) return null
            return (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                {headers.map((h: string, i: number) => (
                                    <th key={i} className="border border-gray-200 p-2 text-left text-sm font-medium text-gray-700 bg-gray-50 min-w-[120px]">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row: string[], ri: number) => (
                                <tr key={ri}>
                                    {row.map((cell: string, ci: number) => (
                                        <td key={ci} className="border border-gray-200 p-2 text-sm text-gray-700">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
        }

        case 'link':
            return (
                <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                    <LinkIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm truncate">
                            {c.linkTitle || c.url}
                        </a>
                    ) : (
                        <span className="text-sm text-gray-400">No link</span>
                    )}
                </div>
            )

        case 'bookmark':
            return c.url ? (
                <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                    {c.bookmarkImage && <img src={c.bookmarkImage} alt="" className="w-full h-40 object-cover" />}
                    <div className="p-4">
                        <h4 className="font-medium text-gray-900 mb-1">{c.bookmarkTitle || 'Untitled'}</h4>
                        <p className="text-sm text-gray-500 line-clamp-2">{c.description || 'No description'}</p>
                        <p className="text-xs text-gray-400 mt-2 truncate">{c.url}</p>
                    </div>
                </a>
            ) : null

        case 'date':
            return (
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg w-fit">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{c.date ?? text}</span>
                    {c.reminder && <span className="text-xs text-gray-400">🔔 Reminder set</span>}
                </div>
            )

        case 'tag':
            return (
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${tagColorClasses[c.tagColor ?? 'gray'] ?? tagColorClasses.gray}`}>
                        {text || 'Tag'}
                    </span>
                </div>
            )

        case 'video': {
            if (!c.url) return null
            const video = getVideoEmbed(c.url)
            if (!video) return (
                <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                    <Video className="h-4 w-4 text-gray-400" />
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">{c.url}</a>
                </div>
            )
            return (
                <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <iframe
                        src={video.platform === 'youtube'
                            ? `https://www.youtube.com/embed/${video.videoId}`
                            : `https://player.vimeo.com/video/${video.videoId}`}
                        className="w-full h-full"
                        allowFullScreen
                        title="Video"
                    />
                </div>
            )
        }

        case 'file':
            return c.fileName ? (
                <a
                    href={c.url ?? '#'}
                    download={c.fileName}
                    className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <FileIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.fileName}</p>
                        {c.fileSize && <p className="text-xs text-gray-500">{(c.fileSize / 1024).toFixed(1)} KB</p>}
                    </div>
                </a>
            ) : null

        case 'equation':
            return (
                <div className="border border-gray-200 rounded-lg p-4">
                    <div className="bg-gray-50 rounded p-4 text-center">
                        <span className="text-lg font-mono text-gray-800">{text || 'E = mc²'}</span>
                    </div>
                </div>
            )

        default:
            return text ? <p className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap">{text}</p> : null
    }
}

// ─── Main public share page ───────────────────────────────────

export default function SharePage() {
    const params = useParams()
    const [page, setPage] = useState<Page | null>(null)
    const [status, setStatus] = useState<'loading' | 'notfound' | 'forbidden' | 'ok'>('loading')

    useEffect(() => {
        if (!params?.id) return
        fetch(`/api/share/${params.id}`)
            .then(async (res) => {
                if (res.status === 404) { setStatus('notfound'); return }
                if (res.status === 403) { setStatus('forbidden'); return }
                if (!res.ok) { setStatus('notfound'); return }
                const data = await res.json()
                setPage(data.page)
                setStatus('ok')
            })
            .catch(() => setStatus('notfound'))
    }, [params?.id])

    // Track numbered list indices
    const getNumberedIndex = (blocks: Block[], currentId: string) => {
        let count = 0
        for (const b of blocks) {
            if (b.type === 'numbered') count++
            if (b.id === currentId) return count
        }
        return 1
    }

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600" />
            </div>
        )
    }

    if (status === 'forbidden') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
                <div className="text-5xl mb-4">🔒</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">This page is private</h1>
                <p className="text-gray-500">The owner hasn&apos;t shared this page publicly.</p>
            </div>
        )
    }

    if (status === 'notfound' || !page) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
                <div className="text-5xl mb-4">📄</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
                <p className="text-gray-500">This page may have been deleted or the link is invalid.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top bar */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    {page.workspace?.name && (
                        <>
                            <span>{page.workspace.name}</span>
                            <span>/</span>
                        </>
                    )}
                    <span className="text-gray-900 font-medium truncate max-w-[200px]">{page.title || 'Untitled'}</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    Read-only
                </span>
            </header>

            {/* Content */}
            <main className="max-w-3xl mx-auto px-4 md:px-8 py-16">
                <div className="bg-white rounded-xl px-8 md:px-12 py-12 shadow-sm">
                    {/* Icon */}
                    {page.icon && (
                        <div className="mb-6 text-6xl">{page.icon}</div>
                    )}

                    {/* Title */}
                    <h1 className="text-[2.75rem] font-black tracking-tighter leading-tight text-gray-900 mb-10">
                        {page.title || 'Untitled'}
                    </h1>

                    {/* Blocks */}
                    <div className="space-y-3">
                        {page.blocks.map((block) => (
                            <div key={block.id}>
                                <ReadonlyBlock
                                    block={block}
                                    numberedIndex={block.type === 'numbered' ? getNumberedIndex(page.blocks, block.id) : undefined}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center py-8 text-xs text-gray-400">
                Made with BorsFlow
            </footer>
        </div>
    )
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { aiComplete, aiErrorMessage, parseAiJson } from '@/lib/ai/client'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppStore } from '@/store/appStore'
import { errorFrom } from '@/lib/products'
import { useI18n } from '@/i18n/I18nProvider'
import AppShell from '@/components/AppShell'
import PagesSidebar from '@/components/pages/PagesSidebar'
import ExportShareToolbar from '@/components/pages/ExportShareToolbar'
import {
    Save,
    MoreVertical,
    Type,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Code,
    Quote,
    Trash2,
    GripVertical,
    MessageSquare,
    X,
    Plus,
    ChevronRight,
    Minus,
    Info,
    Image as ImageIcon,
    Table as TableIcon,
    Link as LinkIcon,
    Bookmark,
    Calendar,
    Tag as TagIcon,
    Video,
    File as FileIcon,
    Sigma,
    Upload,
    ChevronDown,
    Copy,
} from 'lucide-react'

interface Block {
    id: string
    type: string
    content: any
    order: number
}

interface Comment {
    id: string
    content: string
    createdAt: string
    user: {
        id: string
        name: string | null
        email: string
    }
    pageId?: string | null
    blockId?: string | null
}

interface Page {
    id: string
    title: string
    icon: string | null
    coverImage: string | null
    content: any
    workspaceId: string
    isPublic: boolean
    blocks: Block[]
    workspace?: {
        id: string
        name: string
        ownerId: string
    }
}

interface SlashCommandMenuProps {
    position: { x: number; y: number }
    onSelect: (type: string) => void
    onClose: () => void
}

/**
 * Stable id for a new block.
 *
 * Replaces `Math.random().toString(36).substring(7)`, which yielded a handful of
 * characters — and the empty string for a short draw such as 0.5 → "0.i" — giving
 * duplicate React keys and ambiguous identities once the API began matching blocks
 * by id instead of recreating them.
 */
function newBlockId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Re-derive `order` from array position, returning new objects.
 *
 * Insertion used to leave siblings untouched, so `order` values collided; the
 * previous in-place renumbering mutated objects still held in state.
 */
function renumber(blocks: Block[]): Block[] {
    return blocks.map((block, i) => (block.order === i ? block : { ...block, order: i }))
}

/** Comparable form of the editable content, for the autosave's dirty check. */
function snapshot(title: string, blocks: Block[]): string {
    return JSON.stringify({
        title,
        blocks: blocks.map((b) => ({ id: b.id, type: b.type, content: b.content })),
    })
}

function PrintBlock({ block }: { block: Block }) {
    const { t } = useI18n()
    const c = block.content ?? {}
    const text: string = c.text ?? ''
    switch (block.type) {
        case 'heading1':   return <h1>{text}</h1>
        case 'heading2':   return <h2>{text}</h2>
        case 'heading3':   return <h3>{text}</h3>
        case 'bullet':     return <ul><li>{text}</li></ul>
        case 'numbered':   return <ol><li>{text}</li></ol>
        case 'todo':       return <p>{c.checked ? '☑' : '☐'} {text}</p>
        case 'code':       return <pre>{text}</pre>
        case 'quote':      return <blockquote>{text}</blockquote>
        case 'divider':    return <hr />
        case 'callout':    return <div className="callout-block"><p>{c.icon ? `${c.icon} ` : ''}{text}</p></div>
        case 'toggle':     return <><p><strong>{c.toggleTitle}</strong></p><blockquote>{c.toggleContent}</blockquote></>
        case 'image':      return c.url ? <figure><img src={c.url} alt={c.caption ?? ''} />{c.caption && <figcaption>{c.caption}</figcaption>}</figure> : null
        case 'table': {
            const headers: string[] = c.headers ?? []
            const rows: string[][] = c.rows ?? []
            if (!headers.length) return null
            return (
                <table>
                    <thead><tr>{headers.map((h: string, i: number) => <th key={i}>{h}</th>)}</tr></thead>
                    <tbody>{rows.map((row: string[], ri: number) => <tr key={ri}>{row.map((cell: string, ci: number) => <td key={ci}>{cell}</td>)}</tr>)}</tbody>
                </table>
            )
        }
        case 'link':      return <p><a href={c.url}>{c.linkTitle || c.url}</a></p>
        case 'bookmark':  return <p><a href={c.url}>{c.bookmarkTitle || c.url}</a>{c.description && ` — ${c.description}`}</p>
        case 'video':     return <p>[{t('documents.print.video')}: {c.url}]</p>
        case 'file':      return <p>[{t('documents.print.file')}: {c.fileName || c.url}]</p>
        case 'equation':  return <pre>{c.latex}</pre>
        case 'tag':       return <p><code>{text}</code></p>
        case 'date':      return <p>📅 {text}</p>
        default:          return text ? <p>{text}</p> : null
    }
}

type TFunc = ReturnType<typeof useI18n>['t']

/** Block type catalog for the slash menu, block menu and "turn into" list — localized per render. */
function getBlockTypes(t: TFunc) {
    return [
        // Basic Blocks
        { type: 'text', icon: Type, label: t('documents.blockTypes.text.label'), description: t('documents.blockTypes.text.description'), category: t('documents.categories.basic') },
        { type: 'heading1', icon: Heading1, label: t('documents.blockTypes.heading1.label'), description: t('documents.blockTypes.heading1.description'), category: t('documents.categories.basic') },
        { type: 'heading2', icon: Heading2, label: t('documents.blockTypes.heading2.label'), description: t('documents.blockTypes.heading2.description'), category: t('documents.categories.basic') },
        { type: 'heading3', icon: Heading3, label: t('documents.blockTypes.heading3.label'), description: t('documents.blockTypes.heading3.description'), category: t('documents.categories.basic') },
        { type: 'bullet', icon: List, label: t('documents.blockTypes.bullet.label'), description: t('documents.blockTypes.bullet.description'), category: t('documents.categories.basic') },
        { type: 'numbered', icon: ListOrdered, label: t('documents.blockTypes.numbered.label'), description: t('documents.blockTypes.numbered.description'), category: t('documents.categories.basic') },
        { type: 'todo', icon: CheckSquare, label: t('documents.blockTypes.todo.label'), description: t('documents.blockTypes.todo.description'), category: t('documents.categories.basic') },
        { type: 'code', icon: Code, label: t('documents.blockTypes.code.label'), description: t('documents.blockTypes.code.description'), category: t('documents.categories.basic') },
        { type: 'quote', icon: Quote, label: t('documents.blockTypes.quote.label'), description: t('documents.blockTypes.quote.description'), category: t('documents.categories.basic') },

        // Formatting Blocks
        { type: 'divider', icon: Minus, label: t('documents.blockTypes.divider.label'), description: t('documents.blockTypes.divider.description'), category: t('documents.categories.formatting') },
        { type: 'callout', icon: Info, label: t('documents.blockTypes.callout.label'), description: t('documents.blockTypes.callout.description'), category: t('documents.categories.formatting') },
        { type: 'toggle', icon: ChevronRight, label: t('documents.blockTypes.toggle.label'), description: t('documents.blockTypes.toggle.description'), category: t('documents.categories.formatting') },
        { type: 'tag', icon: TagIcon, label: t('documents.blockTypes.tag.label'), description: t('documents.blockTypes.tag.description'), category: t('documents.categories.formatting') },
        { type: 'date', icon: Calendar, label: t('documents.blockTypes.date.label'), description: t('documents.blockTypes.date.description'), category: t('documents.categories.formatting') },
        { type: 'link', icon: LinkIcon, label: t('documents.blockTypes.link.label'), description: t('documents.blockTypes.link.description'), category: t('documents.categories.formatting') },

        // Media Blocks
        { type: 'image', icon: ImageIcon, label: t('documents.blockTypes.image.label'), description: t('documents.blockTypes.image.description'), category: t('documents.categories.media') },
        { type: 'video', icon: Video, label: t('documents.blockTypes.video.label'), description: t('documents.blockTypes.video.description'), category: t('documents.categories.media') },
        { type: 'file', icon: FileIcon, label: t('documents.blockTypes.file.label'), description: t('documents.blockTypes.file.description'), category: t('documents.categories.media') },

        // Advanced Blocks
        { type: 'table', icon: TableIcon, label: t('documents.blockTypes.table.label'), description: t('documents.blockTypes.table.description'), category: t('documents.categories.advanced') },
        { type: 'bookmark', icon: Bookmark, label: t('documents.blockTypes.bookmark.label'), description: t('documents.blockTypes.bookmark.description'), category: t('documents.categories.advanced') },
        { type: 'equation', icon: Sigma, label: t('documents.blockTypes.equation.label'), description: t('documents.blockTypes.equation.description'), category: t('documents.categories.advanced') },
    ]
}

function SlashCommandMenu({ position, onSelect, onClose }: SlashCommandMenuProps) {
    const { t } = useI18n()
    const [selectedIndex, setSelectedIndex] = useState(0)
    const menuRef = useRef<HTMLDivElement>(null)
    const blockTypes = getBlockTypes(t)

    // Group blocks by category
    const groupedBlocks = blockTypes.reduce((acc, block) => {
        const category = block.category || t('documents.categories.basic')
        if (!acc[category]) {
            acc[category] = []
        }
        acc[category].push(block)
        return acc
    }, {} as Record<string, typeof blockTypes>)

    // Flatten blocks for keyboard navigation
    const flatBlocks = Object.values(groupedBlocks).flat()

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex((prev) => (prev + 1) % flatBlocks.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex((prev) => (prev - 1 + flatBlocks.length) % flatBlocks.length)
        } else if (e.key === 'Enter') {
            e.preventDefault()
            onSelect(flatBlocks[selectedIndex].type)
        } else if (e.key === 'Escape') {
            onClose()
        }
    }, [selectedIndex, onSelect, onClose, flatBlocks])

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return (
        <div
            ref={menuRef}
            className="fixed bg-white dark:bg-surface-dim rounded-xl shadow-2xl border border-gray-200 dark:border-outline-variant/30 py-2 z-50 max-w-sm overflow-hidden max-h-96 overflow-y-auto"
            style={{ left: position.x, top: position.y }}
        >
            {Object.entries(groupedBlocks).map(([category, blocks], groupIndex) => (
                <div key={category}>
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-outline-variant/20">
                        <p className="text-xs font-semibold text-gray-500 dark:text-on-surface-variant">{t('documents.blocksGroupLabel', { category })}</p>
                    </div>
                    {blocks.map((block) => (
                        <button
                            key={block.type}
                            onClick={() => onSelect(block.type)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-surface-container-low transition-colors ${flatBlocks[selectedIndex]?.type === block.type ? 'bg-gray-50 dark:bg-surface-container-low' : ''
                                }`}
                        >
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-surface-container-high flex items-center justify-center">
                                <block.icon className="h-4 w-4 text-gray-600 dark:text-on-surface-variant" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium text-gray-900 dark:text-on-surface">{block.label}</p>
                                <p className="text-xs text-gray-500 dark:text-on-surface-variant">{block.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    )
}

interface BlockContextMenuProps {
    position: { x: number; y: number }
    onClose: () => void
    onDuplicate: () => void
    onDelete: () => void
    onTransform: (type: string) => void
    currentType: string
}

function BlockContextMenu({ position, onClose, onDuplicate, onDelete, onTransform, currentType }: BlockContextMenuProps) {
    const { t } = useI18n()
    const menuRef = useRef<HTMLDivElement>(null)
    const [showTransformMenu, setShowTransformMenu] = useState(false)
    const blockTypes = getBlockTypes(t)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    return (
        <div
            ref={menuRef}
            className="fixed bg-white dark:bg-surface-dim rounded-xl shadow-2xl border border-gray-200 dark:border-outline-variant/30 py-2 z-50 min-w-[200px]"
            style={{ left: position.x + 10, top: position.y }}
        >
            <div className="flex flex-col">
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-surface-container-low w-full text-left"
                >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete')}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-on-surface hover:bg-gray-50 dark:hover:bg-surface-container-low w-full text-left"
                >
                    <Copy className="h-4 w-4" />
                    {t('documents.duplicate')}
                </button>
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowTransformMenu(!showTransformMenu); }}
                        className="flex justify-between items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-on-surface hover:bg-gray-50 dark:hover:bg-surface-container-low w-full text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Type className="h-4 w-4" />
                            {t('documents.turnInto')}
                        </div>
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    {showTransformMenu && (
                        <div className="absolute top-0 left-full ml-1 bg-white dark:bg-surface-dim rounded-xl shadow-2xl border border-gray-200 dark:border-outline-variant/30 py-2 z-50 min-w-[200px] max-h-64 overflow-y-auto">
                            {blockTypes.slice(0, 9).map((bt) => (
                                <button
                                    key={bt.type}
                                    onClick={(e) => { e.stopPropagation(); onTransform(bt.type); }}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm w-full text-left hover:bg-gray-50 dark:hover:bg-surface-container-low ${currentType === bt.type ? 'bg-blue-50/50 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-on-surface'}`}
                                >
                                    <bt.icon className="h-4 w-4" />
                                    {bt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Block Components
function TextBlock({ value, onChange, onKeyDown, placeholder, className }: any) {
    return (
        <textarea
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={2}
            className={`
                w-full bg-transparent focus:outline-none resize-none
                text-base leading-relaxed text-gray-800 dark:text-on-surface
                placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                ${className}
            `}
        />
    )
}

function Heading1Block({ value, onChange, onKeyDown, placeholder, className }: any) {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={`
                w-full bg-transparent focus:outline-none
                text-3xl font-bold text-gray-900 dark:text-on-surface
                placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                tracking-tight
                ${className}
            `}
        />
    )
}

function Heading2Block({ value, onChange, onKeyDown, placeholder, className }: any) {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={`
                w-full bg-transparent focus:outline-none
                text-2xl font-semibold text-gray-900 dark:text-on-surface
                placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                tracking-tight
                ${className}
            `}
        />
    )
}

function Heading3Block({ value, onChange, onKeyDown, placeholder, className }: any) {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={`
                w-full bg-transparent focus:outline-none
                text-xl font-medium text-gray-900 dark:text-on-surface
                placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                ${className}
            `}
        />
    )
}

function BulletBlock({ value, onChange, onKeyDown, placeholder, className }: any) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-2 text-gray-400 dark:text-on-surface-variant text-lg leading-none">•</span>
            <textarea
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                rows={1}
                className={`
                    flex-1 bg-transparent focus:outline-none resize-none
                    text-base leading-relaxed text-gray-800 dark:text-on-surface
                    placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                    ${className}
                `}
            />
        </div>
    )
}

function NumberedBlock({ value, onChange, onKeyDown, placeholder, className, index }: any) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-2 text-gray-400 dark:text-on-surface-variant text-sm font-medium min-w-[1.5rem]">
                {index}.
            </span>
            <textarea
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                rows={1}
                className={`
                    flex-1 bg-transparent focus:outline-none resize-none
                    text-base leading-relaxed text-gray-800 dark:text-on-surface
                    placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                    ${className}
                `}
            />
        </div>
    )
}

function TodoBlock({ value, onChange, onKeyDown, placeholder, className, checked, onCheck }: any) {
    return (
        <div className="flex items-start gap-3">
            <input
                type="checkbox"
                checked={checked}
                onChange={onCheck}
                className="mt-2.5 h-4 w-4 rounded border-gray-300 dark:border-outline-variant text-blue-600 dark:text-secondary focus:ring-blue-500 dark:focus:ring-secondary cursor-pointer transition-all"
            />
            <textarea
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                rows={1}
                className={`
                    flex-1 bg-transparent focus:outline-none resize-none
                    text-base leading-relaxed transition-all
                    ${checked ? 'line-through text-gray-400 dark:text-on-surface-variant' : 'text-gray-800 dark:text-on-surface'}
                    placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                    ${className}
                `}
            />
        </div>
    )
}

function CodeBlock({ value, onChange, onKeyDown, placeholder, className }: any) {
    const { t } = useI18n()
    return (
        <div className="relative">
            <div className="absolute top-3 right-3 px-2 py-1 bg-gray-100 dark:bg-surface-container-high rounded text-xs text-gray-500 dark:text-on-surface-variant font-mono">
                {t('documents.blockTypes.code.label')}
            </div>
            <textarea
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                rows={4}
                className={`
                    w-full bg-gray-50 dark:bg-surface-container-highest
                    rounded-lg p-4 font-mono text-sm
                    text-gray-800 dark:text-on-surface
                    placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-secondary/20
                    resize-none
                    ${className}
                `}
            />
        </div>
    )
}

function QuoteBlock({ value, onChange, onKeyDown, placeholder, className }: any) {
    return (
        <div className="border-l-4 border-gray-300 dark:border-outline-variant/50 pl-4">
            <textarea
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                rows={2}
                className={`
                    w-full bg-transparent focus:outline-none resize-none
                    text-base leading-relaxed italic text-gray-700 dark:text-on-surface-variant
                    placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                    ${className}
                `}
            />
        </div>
    )
}

function DividerBlock({ className }: any) {
    return (
        <hr className={`my-4 border-gray-200 dark:border-outline-variant/50 ${className}`} />
    )
}

function CalloutBlock({ value, onChange, placeholder, className, color = 'gray', icon = '💡', onColorChange, onIconChange }: any) {
    const colorClasses: Record<string, string> = {
        gray: 'bg-gray-50 dark:bg-surface-container-low border-gray-200 dark:border-outline-variant/50',
        blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
        red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
        purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    }
    
    return (
        <div className={`p-4 rounded-lg border ${colorClasses[color] || colorClasses.gray}`}>
            <div className="flex items-start gap-3">
                <span className="text-xl cursor-pointer" onClick={onIconChange}>{icon}</span>
                <textarea
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    rows={2}
                    className={`
                        flex-1 bg-transparent focus:outline-none resize-none
                        text-base leading-relaxed text-gray-800 dark:text-on-surface
                        placeholder:text-gray-400 dark:placeholder:text-on-surface-variant/50
                        ${className}
                    `}
                />
            </div>
        </div>
    )
}

function ToggleBlock({ value, onChange, placeholder, className, isOpen = false, onToggle, toggleContent, onToggleContentChange }: any) {
    const { t } = useI18n()
    return (
        <div className={className}>
            <button
                onClick={onToggle}
                className="flex items-center gap-2 w-full text-left group"
            >
                <ChevronRight
                    className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                />
                <input
                    type="text"
                    value={value}
                    onChange={onChange}
                    placeholder={t('documents.blocks.toggleTitlePlaceholder')}
                    className="flex-1 bg-transparent focus:outline-none text-base"
                />
            </button>
            {isOpen && (
                <textarea
                    value={toggleContent || ''}
                    onChange={onToggleContentChange}
                    placeholder={t('documents.blocks.toggleContentPlaceholder')}
                    rows={3}
                    className="w-full mt-2 ml-6 bg-transparent focus:outline-none resize-none text-base leading-relaxed text-gray-700 dark:text-on-surface-variant"
                />
            )}
        </div>
    )
}

function ImageBlock({ value, onChange, placeholder, className, url, caption, onCaptionChange, onUpload, blockId }: any) {
    const { t } = useI18n()
    const inputId = `image-upload-${blockId}`
    return (
        <div className={className}>
            {url ? (
                <div className="relative group">
                    <img src={url} alt={value} className="rounded-lg max-w-full" />
                    <input
                        type="text"
                        value={caption || ''}
                        onChange={onCaptionChange}
                        placeholder={t('documents.blocks.imageCaptionPlaceholder')}
                        className="mt-2 w-full text-sm bg-transparent focus:outline-none text-gray-600 dark:text-on-surface-variant"
                    />
                </div>
            ) : (
                <div className="border-2 border-dashed border-gray-300 dark:border-outline-variant/50 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-outline-variant transition-colors">
                    <input type="file" accept="image/*" onChange={onUpload} className="hidden" id={inputId} />
                    <label htmlFor={inputId} className="cursor-pointer">
                        <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-500">{t('documents.blocks.imageUploadLabel')}</p>
                    </label>
                </div>
            )}
        </div>
    )
}

function TableBlock({ value, onChange, placeholder, className, headers, rows = [['', '', ''], ['', '', '']], onHeaderChange, onCellChange, onAddRow, onAddColumn, onDeleteRow }: any) {
    const { t } = useI18n()
    const resolvedHeaders: string[] = headers ?? [1, 2, 3].map((n) => t('documents.blocks.columnLabel', { number: n }))
    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        {resolvedHeaders.map((header: string, index: number) => (
                            <th key={index} className="border border-gray-200 dark:border-outline-variant/50 p-2 min-w-[150px]">
                                <input
                                    type="text"
                                    value={header}
                                    onChange={(e) => onHeaderChange?.(index, e.target.value)}
                                    className="w-full bg-transparent focus:outline-none text-sm font-medium text-gray-700 dark:text-on-surface-variant"
                                />
                            </th>
                        ))}
                        <th className="border border-gray-200 dark:border-outline-variant/50 p-2 w-10">
                            <button onClick={onAddColumn} className="text-gray-400 hover:text-gray-600 text-lg">+</button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row: string[], rowIndex: number) => (
                        <tr key={rowIndex}>
                            {row.map((cell: string, cellIndex: number) => (
                                <td key={cellIndex} className="border border-gray-200 dark:border-outline-variant/50 p-2">
                                    <input
                                        type="text"
                                        value={cell}
                                        onChange={(e) => onCellChange?.(rowIndex, cellIndex, e.target.value)}
                                        className="w-full bg-transparent focus:outline-none text-sm text-gray-700 dark:text-on-surface-variant"
                                    />
                                </td>
                            ))}
                            <td className="border border-gray-200 dark:border-outline-variant/50 p-2 w-10">
                                <button onClick={() => onDeleteRow?.(rowIndex)} className="text-gray-400 hover:text-red-500 text-lg">×</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button onClick={onAddRow} className="mt-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <Plus className="h-4 w-4" /> {t('documents.blocks.tableAddRow')}
            </button>
        </div>
    )
}

function LinkBlock({ value, onChange, placeholder, className, url, linkTitle, onUrlChange, onTitleChange }: any) {
    const { t } = useI18n()
    return (
        <div className={className}>
            <div className="flex items-center gap-2 p-3 border border-gray-200 dark:border-outline-variant/50 rounded-lg">
                <LinkIcon className="h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    value={url || value}
                    onChange={onUrlChange || onChange}
                    placeholder={t('documents.blocks.linkPlaceholder')}
                    className="flex-1 bg-transparent focus:outline-none text-sm"
                />
            </div>
            {url && (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-2 text-blue-600 dark:text-secondary hover:underline text-sm"
                >
                    <LinkIcon className="h-4 w-4" />
                    <span>{linkTitle || url}</span>
                </a>
            )}
        </div>
    )
}

function BookmarkBlock({ className, url, bookmarkTitle, description, bookmarkImage, onUrlChange }: any) {
    const { t } = useI18n()
    return (
        <div className={className}>
            {!url ? (
                <div className="border border-gray-200 dark:border-outline-variant/50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <Bookmark className="h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={url || ''}
                            onChange={onUrlChange}
                            placeholder={t('documents.blocks.bookmarkPlaceholder')}
                            className="flex-1 bg-transparent focus:outline-none text-sm"
                        />
                    </div>
                </div>
            ) : (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-gray-200 dark:border-outline-variant/50 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                    {bookmarkImage && <img src={bookmarkImage} alt="" className="w-full h-40 object-cover" />}
                    <div className="p-4">
                        <h4 className="font-medium text-gray-900 dark:text-on-surface mb-1">{bookmarkTitle || t('documents.untitled')}</h4>
                        <p className="text-sm text-gray-500 dark:text-on-surface-variant line-clamp-2">{description || t('documents.blocks.bookmarkNoDescription')}</p>
                        <p className="text-xs text-gray-400 mt-2 truncate">{url}</p>
                    </div>
                </a>
            )}
        </div>
    )
}

function DateBlock({ value, onChange, placeholder, className, date, reminder, onDateChange, onReminderToggle }: any) {
    const { t } = useI18n()
    return (
        <div className={`flex items-center gap-3 p-3 border border-gray-200 dark:border-outline-variant/50 rounded-lg ${className}`}>
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
                type="date"
                value={date}
                onChange={onDateChange}
                className="bg-transparent focus:outline-none text-sm"
            />
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={reminder}
                    onChange={onReminderToggle}
                    className="rounded border-gray-300 dark:border-outline-variant"
                />
                <span className="text-sm text-gray-500 dark:text-on-surface-variant">{t('documents.blocks.dateRemindMe')}</span>
            </label>
        </div>
    )
}

function TagBlock({ value, onChange, placeholder, className, tagColor = 'gray', onColorChange }: any) {
    const { t } = useI18n()
    const colorClasses: Record<string, string> = {
        gray: 'bg-gray-100 dark:bg-surface-container-high text-gray-700 dark:text-on-surface-variant',
        blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
        green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
        yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
        red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
        pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
        orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${colorClasses[tagColor] || colorClasses.gray}`}>
                {value || t('documents.blocks.tagDefault')}
            </span>
            <input
                type="text"
                value={value}
                onChange={onChange}
                placeholder={t('documents.blocks.tagPlaceholder')}
                className="flex-1 bg-transparent focus:outline-none text-sm"
            />
        </div>
    )
}

function VideoBlock({ className, url, onUrlChange }: any) {
    const { t } = useI18n()
    const getVideoEmbed = (url: string) => {
        // Parse YouTube URL
        const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
        if (youtubeMatch) {
            return { platform: 'youtube', videoId: youtubeMatch[1] }
        }
        // Parse Vimeo URL
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
        if (vimeoMatch) {
            return { platform: 'vimeo', videoId: vimeoMatch[1] }
        }
        return null
    }
    
    const video = url ? getVideoEmbed(url) : null
    
    return (
        <div className={className}>
            {!video ? (
                <div className="border border-gray-200 dark:border-outline-variant/50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={url || ''}
                            onChange={onUrlChange}
                            placeholder={t('documents.blocks.videoPlaceholder')}
                            className="flex-1 bg-transparent focus:outline-none text-sm"
                        />
                    </div>
                </div>
            ) : (
                <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-surface-container-highest">
                    {video.platform === 'youtube' ? (
                        <iframe
                            src={`https://www.youtube.com/embed/${video.videoId}`}
                            className="w-full h-full"
                            allowFullScreen
                            title={t('documents.blocks.youtubeTitle')}
                        />
                    ) : (
                        <iframe
                            src={`https://player.vimeo.com/video/${video.videoId}`}
                            className="w-full h-full"
                            allowFullScreen
                            title={t('documents.blocks.vimeoTitle')}
                        />
                    )}
                </div>
            )}
        </div>
    )
}

function FileBlock({ value, onChange, placeholder, className, fileName, fileSize, onUpload, blockId }: any) {
    const { t } = useI18n()
    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
    const inputId = `file-upload-${blockId}`

    return (
        <div className={className}>
            {fileName ? (
                <a
                    href={value}
                    download={fileName}
                    className="flex items-center gap-3 p-4 border border-gray-200 dark:border-outline-variant/50 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-container-low transition-colors"
                >
                    <FileIcon className="h-8 w-8 text-gray-400" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-on-surface truncate">{fileName}</p>
                        <p className="text-xs text-gray-500">{fileSize ? formatFileSize(fileSize) : t('documents.blocks.fileUnknownSize')}</p>
                    </div>
                </a>
            ) : (
                <div className="border-2 border-dashed border-gray-300 dark:border-outline-variant/50 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-outline-variant transition-colors">
                    <input type="file" onChange={onUpload} className="hidden" id={inputId} />
                    <label htmlFor={inputId} className="cursor-pointer">
                        <FileIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-500">{t('documents.blocks.fileUploadLabel')}</p>
                    </label>
                </div>
            )}
        </div>
    )
}

function EquationBlock({ value, onChange, placeholder, className }: any) {
    const { t } = useI18n()
    return (
        <div className={`border border-gray-200 dark:border-outline-variant/50 rounded-lg p-4 ${className}`}>
            <div className="bg-gray-50 dark:bg-surface-container-highest rounded p-4 mb-2 text-center">
                <span className="text-lg font-mono text-gray-800 dark:text-on-surface">{value || 'E = mc^2'}</span>
            </div>
            <input
                type="text"
                value={value}
                onChange={onChange}
                placeholder={t('documents.blocks.equationPlaceholder')}
                className="w-full bg-transparent focus:outline-none font-mono text-sm text-gray-700 dark:text-on-surface-variant"
            />
        </div>
    )
}

export default function PageEditorPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const params = useParams()
    const { setPage } = useAppStore()
    const { t, formatDate } = useI18n()

    const [page, setPageState] = useState<Page | null>(null)
    const [accessLevel, setAccessLevel] = useState<string>('ADMIN')
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const [title, setTitle] = useState('')
    const [blocks, setBlocks] = useState<Block[]>([])
    const [showBlockMenu, setShowBlockMenu] = useState(false)
    const [slashMenu, setSlashMenu] = useState<{ position: { x: number; y: number }; blockId: string } | null>(null)
    const [showComments, setShowComments] = useState(false)
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState('')
    const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)
    const [blockContextMenu, setBlockContextMenu] = useState<{ blockId: string, position: { x: number, y: number } } | null>(null)
    const [isGeneratingOutline, setIsGeneratingOutline] = useState(false)
    const [showAiPromptInput, setShowAiPromptInput] = useState(false)
    const [aiPromptValue, setAiPromptValue] = useState('')
    const [isGeneratingFromPrompt, setIsGeneratingFromPrompt] = useState(false)
    const aiPromptRef = useRef<HTMLInputElement>(null)
    const [showToneMenu, setShowToneMenu] = useState(false)
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
    const [isToneLoading, setIsToneLoading] = useState(false)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    /** Content as of the last successful load or save; the autosave's dirty check. */
    const lastSavedSnapshotRef = useRef<string>('')
    /** Focusable element per block id, so Enter/Backspace can target a block directly. */
    const blockRefs = useRef(new Map<string, HTMLElement>())

    /** Blocks from an AI answer shaped `{ "blocks": [{ "type", "text" }] }`. */
    const aiBlocks = (raw: string) => {
        const parsed = parseAiJson<{ blocks?: { type?: string; text?: string }[] }>(raw)
        const allowed = ['heading1', 'heading2', 'heading3', 'text', 'bullet', 'numbered', 'todo', 'quote']
        const items = (parsed.blocks ?? []).filter(item => typeof item?.text === 'string' && item.text.trim())
        if (items.length === 0) throw new Error('empty')
        return items.map((item, i) => ({
            id: newBlockId(),
            type: allowed.includes(item.type ?? '') ? item.type! : 'text',
            content: { text: item.text!.trim() },
            order: blocks.length + i,
        }))
    }

    const generateOutline = async () => {
        if (!title.trim() || isGeneratingOutline || accessLevel === 'VIEW') return
        setIsGeneratingOutline(true)
        setAiError(null)
        try {
            const raw = await aiComplete({ pageId: params.id as string }, {
                prompt: `Generate a structured document outline for the topic: "${title}"\n\nReturn a JSON object of this shape:\n{"blocks":[{"type":"heading1","text":"Section Title"},{"type":"heading2","text":"Subsection"},{"type":"text","text":"Brief description"}]}\n\nInclude 2-4 main sections with 1-2 subsections each.`,
                json: true,
            })
            const newBlocks = aiBlocks(raw)
            setBlocks(prev => [...prev, ...newBlocks])
        } catch (error) {
            setAiError(aiErrorMessage(error, t('documents.outlineErrorFallback')))
        } finally {
            setIsGeneratingOutline(false)
        }
    }

    const generateFromPrompt = async () => {
        if (!aiPromptValue.trim() || isGeneratingFromPrompt) return
        setIsGeneratingFromPrompt(true)
        setAiError(null)
        try {
            const raw = await aiComplete({ pageId: params.id as string }, {
                prompt: `Write a complete, well-structured document about: "${aiPromptValue}"\n\nReturn a JSON object of this shape:\n{"blocks":[{"type":"heading1","text":"Title"},{"type":"heading2","text":"Section"},{"type":"text","text":"Paragraph content"}]}\n\nUse a mix of heading1, heading2, text, bullet, and numbered block types as appropriate. Make it thorough and detailed.`,
                json: true,
                maxTokens: 2048,
            })
            const newBlocks = aiBlocks(raw)
            setBlocks(prev => [...prev, ...newBlocks])
            setAiPromptValue('')
            setShowAiPromptInput(false)
        } catch (error) {
            setAiError(aiErrorMessage(error, t('documents.documentErrorFallback')))
        } finally {
            setIsGeneratingFromPrompt(false)
        }
    }

    const rewriteBlockTone = async (blockId: string, tone: string) => {
        const block = blocks.find(b => b.id === blockId)
        if (!block) return
        const text = block.content?.text || ''
        if (!text.trim()) return
        setIsToneLoading(true)
        setAiError(null)
        setShowToneMenu(false)
        try {
            const result = await aiComplete({ pageId: params.id as string }, {
                prompt: `Rewrite this text in a ${tone} tone. Return only the rewritten text.`,
                text,
            })
            setBlocks(prev => prev.map(b =>
                b.id === blockId ? { ...b, content: { ...b.content, text: result.trim() } } : b
            ))
        } catch (error) {
            setAiError(aiErrorMessage(error, t('documents.toneErrorFallback')))
        } finally {
            setIsToneLoading(false)
            setSelectedBlockId(null)
        }
    }

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        }
    }, [status, router])

    useEffect(() => {
        if (session && params.id) {
            setPage(params.id as string)
            fetchPage()
        }
    }, [session, params.id, setPage])

    // Auto-save with debounce.
    //
    // Gated on the content actually differing from what the server last gave us.
    // The previous guard (`blocks.length > 0`) was satisfied by any non-empty page
    // the moment fetchPage populated state, so merely opening a page wrote it back —
    // which rewrote every block row and detached anchored comments on every view.
    useEffect(() => {
        if (!page) return
        if (accessLevel === 'VIEW') return

        const dirty = snapshot(title, blocks) !== lastSavedSnapshotRef.current
        setIsDirty(dirty)
        if (!dirty) return

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = setTimeout(() => { handleSave() }, 1500)

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [title, blocks, page, accessLevel])

    // A debounced save means the last edit is still pending for up to 1.5s; without
    // this the tab can close on top of it with no warning.
    useEffect(() => {
        if (!isDirty) return
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [isDirty])

    const fetchComments = async (workspaceId: string) => {
        try {
            const res = await fetch(`/api/workspaces/${workspaceId}/comments?pageId=${params.id}`)
            if (!res.ok) return
            const data = await res.json()
            setComments(data.comments || [])
        } catch (error) {
            console.error('Error fetching comments:', error)
        }
    }

    const fetchPage = async () => {
        try {
            const response = await fetch(`/api/pages/${params.id}`)
            const data = await response.json()
            setPageState(data.page)
            setAccessLevel(data.accessLevel ?? 'ADMIN')
            setTitle(data.page.title)

            // Prefer the Block relation table; fall back to content JSON for pages
            // saved before block-table syncing was introduced.
            let loadedBlocks: Block[] = data.page.blocks || []
            if (loadedBlocks.length === 0 && data.page.content) {
                try {
                    const parsed = typeof data.page.content === 'string'
                        ? JSON.parse(data.page.content)
                        : data.page.content
                    if (Array.isArray(parsed?.blocks) && parsed.blocks.length > 0) {
                        loadedBlocks = parsed.blocks.map((b: any, i: number) => ({
                            id: b.id ?? newBlockId(),
                            type: b.type ?? 'text',
                            content: typeof b.content === 'string' ? JSON.parse(b.content) : (b.content ?? {}),
                            order: b.order ?? i,
                        }))
                    }
                } catch {
                    // content JSON unparseable — start with empty blocks
                }
            } else {
                // Blocks from DB have content stored as JSON strings — parse them
                loadedBlocks = loadedBlocks.map((b: any) => ({
                    ...b,
                    content: typeof b.content === 'string' ? (() => { try { return JSON.parse(b.content) } catch { return {} } })() : (b.content ?? {}),
                }))
            }

            setBlocks(loadedBlocks)
            // Baseline for the autosave's dirty check: nothing has changed yet, so
            // loading a page must not schedule a write.
            lastSavedSnapshotRef.current = snapshot(data.page.title, loadedBlocks)
            setIsDirty(false)
            if (data.page?.workspaceId) fetchComments(data.page.workspaceId)
        } catch (error) {
            console.error('Error fetching page:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        // Capture what is being sent: state can move on while the request is in
        // flight, and marking that newer content as saved would drop it.
        const pending = snapshot(title, blocks)
        setIsSaving(true)
        try {
            const res = await fetch(`/api/pages/${params.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    content: { type: 'doc', blocks },
                }),
            })

            // fetch does not throw on 4xx/5xx, so without this a rejected save —
            // a 403 from view-only access, a 500 — looked identical to a saved one.
            if (!res.ok) {
                setSaveError(await errorFrom(res, t('documents.saveErrorFallback')))
                return
            }

            lastSavedSnapshotRef.current = pending
            setSaveError(null)
            setIsDirty(false)
        } catch (error) {
            console.error('Error saving page:', error)
            setSaveError(t('documents.saveErrorNetwork'))
        } finally {
            setIsSaving(false)
        }
    }

    const getDefaultContent = (type: string) => {
        switch (type) {
            case 'table':    return { headers: [1, 2, 3].map((n) => t('documents.blocks.columnLabel', { number: n })), rows: [['', '', ''], ['', '', '']] }
            case 'toggle':   return { toggleTitle: '', toggleContent: '', isOpen: false }
            case 'callout':  return { text: '', icon: '💡', color: 'gray' }
            case 'todo':     return { text: '', checked: false }
            case 'tag':      return { text: '', tagColor: 'gray' }
            case 'date':     return { date: '', reminder: false }
            case 'image':    return { url: '', caption: '' }
            case 'video':    return { url: '' }
            case 'file':     return { url: '', fileName: '', fileSize: 0 }
            case 'link':     return { url: '', linkTitle: '' }
            case 'bookmark': return { url: '', bookmarkTitle: '', description: '' }
            case 'equation': return { latex: '' }
            case 'divider':  return {}
            default:         return { text: '' }
        }
    }

    /** Returns the new block's id so callers can move focus to it. */
    const addBlock = (type: string, afterBlockId?: string): string => {
        const newBlock: Block = {
            id: newBlockId(),
            type,
            content: getDefaultContent(type),
            order: 0,
        }

        if (afterBlockId) {
            const index = blocks.findIndex(b => b.id === afterBlockId)
            // When invoked from the slash command, replace the trigger block
            // (which contains just "/") with the new typed block instead of
            // inserting an extra block after it.
            const triggerBlock = blocks[index]
            const isSlashTrigger =
                triggerBlock &&
                (triggerBlock.content?.text === '/' || triggerBlock.content?.text === '')
            const newBlocks = [...blocks]
            if (isSlashTrigger) {
                newBlocks[index] = newBlock
            } else {
                newBlocks.splice(index + 1, 0, newBlock)
            }
            setBlocks(renumber(newBlocks))
        } else {
            setBlocks(renumber([...blocks, newBlock]))
        }

        setShowBlockMenu(false)
        setSlashMenu(null)
        return newBlock.id
    }

    const updateBlockContent = (blockId: string, content: any) => {
        setBlocks(
            blocks.map((block) =>
                block.id === blockId ? { ...block, content } : block
            )
        )
    }

    const deleteBlock = (blockId: string) => {
        blockRefs.current.delete(blockId)
        setBlocks(renumber(blocks.filter((block) => block.id !== blockId)))
    }

    const handleBlockDragStart = (e: React.DragEvent, blockId: string) => {
        setDraggedBlockId(blockId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleBlockDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleBlockDrop = (e: React.DragEvent, targetBlockId: string) => {
        e.preventDefault()
        if (!draggedBlockId || draggedBlockId === targetBlockId) return

        const draggedIndex = blocks.findIndex(b => b.id === draggedBlockId)
        const targetIndex = blocks.findIndex(b => b.id === targetBlockId)

        const newBlocks = [...blocks]
        const [draggedBlock] = newBlocks.splice(draggedIndex, 1)
        newBlocks.splice(targetIndex, 0, draggedBlock)

        setBlocks(renumber(newBlocks))
        setDraggedBlockId(null)
    }

    /**
     * Move focus to a block by id, after React has committed the new list.
     *
     * Replaces indexing into every textarea/input under the editor: table, callout,
     * toggle, link and date blocks each render several fields, so one such block
     * above the cursor shifted the index and Enter focused the wrong field.
     */
    const registerBlockRef = useCallback((blockId: string, el: HTMLElement | null) => {
        if (el) blockRefs.current.set(blockId, el)
        else blockRefs.current.delete(blockId)
    }, [])

    const focusBlock = useCallback((blockId: string) => {
        requestAnimationFrame(() => {
            const el = blockRefs.current.get(blockId)
            if (!el) return
            el.focus()
            if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
                const end = el.value.length
                el.setSelectionRange(end, end)
            }
        })
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent, blockId: string) => {
        const target = e.target as HTMLTextAreaElement | HTMLInputElement
        const isEmpty = target.value === ''

        if (e.key === '/' && isEmpty) {
            const rect = target.getBoundingClientRect()
            // Clear the "/" character from block content so it doesn't appear in the output
            updateBlockContent(blockId, { ...(blocks.find(b => b.id === blockId)?.content ?? {}), text: '' })
            setSlashMenu({
                position: { x: rect.left, y: rect.bottom + 8 },
                blockId,
            })
            return
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            const currentBlock = blocks.find(b => b.id === blockId)
            const type = currentBlock?.type || ''
            
            const continuousTypes = ['bullet', 'numbered', 'todo']
            
            if (isEmpty && continuousTypes.includes(type)) {
                transformBlock(blockId, 'text')
                focusBlock(blockId)
                return
            }

            const typeToCreate = continuousTypes.includes(type) ? type : 'text'
            focusBlock(addBlock(typeToCreate, blockId))
            return
        }

        if (e.key === 'Backspace' && isEmpty) {
            e.preventDefault()
            const index = blocks.findIndex(b => b.id === blockId)
            const previousId = index > 0 ? blocks[index - 1].id : null
            deleteBlock(blockId)
            if (previousId) focusBlock(previousId)
        }
    }

    const addComment = async () => {
        if (!newComment.trim() || !page) return
        try {
            const res = await fetch(`/api/workspaces/${page.workspaceId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newComment, pageId: page.id }),
            })
            if (!res.ok) throw new Error('Failed to add comment')
            const data = await res.json()
            setComments((prev) => [...prev, data.comment])
            setNewComment('')
        } catch (error) {
            console.error('Error adding comment:', error)
        }
    }

    const duplicateBlock = (blockId: string) => {
        const index = blocks.findIndex(b => b.id === blockId)
        if (index === -1) return
        
        const blockToDuplicate = blocks[index]
        const newBlock: Block = {
            ...blockToDuplicate,
            id: newBlockId(),
            content: JSON.parse(JSON.stringify(blockToDuplicate.content))
        }

        const newBlocks = [...blocks]
        newBlocks.splice(index + 1, 0, newBlock)

        setBlocks(renumber(newBlocks))
        setBlockContextMenu(null)
    }

    const transformBlock = (blockId: string, newType: string) => {
        setBlocks(blocks.map(b => b.id === blockId ? { ...b, type: newType } : b))
        setBlockContextMenu(null)
    }

    const handleBlockMenuClick = (e: React.MouseEvent, blockId: string) => {
        e.preventDefault()
        e.stopPropagation()
        setBlockContextMenu({
            blockId,
            position: { x: e.clientX, y: e.clientY }
        })
    }

    const renderBlock = (block: Block) => {
        const commonProps = {
            value: block.content.text || '',
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
                updateBlockContent(block.id, { text: e.target.value }),
            onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, block.id),
            placeholder: t('documents.typeCommandPlaceholder'),
        }

        switch (block.type) {
            case 'text':
                return <TextBlock {...commonProps} />
            case 'heading1':
                return <Heading1Block {...commonProps} placeholder={t('documents.blockTypes.heading1.label')} />
            case 'heading2':
                return <Heading2Block {...commonProps} placeholder={t('documents.blockTypes.heading2.label')} />
            case 'heading3':
                return <Heading3Block {...commonProps} placeholder={t('documents.blockTypes.heading3.label')} />
            case 'bullet':
                return <BulletBlock {...commonProps} />
            case 'numbered':
                const index = blocks.filter(b => b.type === 'numbered').findIndex(b => b.id === block.id) + 1
                return <NumberedBlock {...commonProps} index={index} />
            case 'todo':
                return (
                    <TodoBlock
                        {...commonProps}
                        checked={block.content.checked || false}
                        onCheck={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, {
                                ...block.content,
                                checked: e.target.checked,
                            })
                        }
                    />
                )
            case 'code':
                return <CodeBlock {...commonProps} />
            case 'quote':
                return <QuoteBlock {...commonProps} />
            case 'divider':
                return <DividerBlock />
            case 'callout':
                return (
                    <CalloutBlock
                        {...commonProps}
                        color={block.content.color || 'gray'}
                        icon={block.content.icon || '💡'}
                        onColorChange={(color: string) =>
                            updateBlockContent(block.id, { ...block.content, color })
                        }
                        onIconChange={() => {
                            const icons = ['💡', '⚠️', '✅', '❌', 'ℹ️', '📌', '🔥', '💬', '📝', '🎯']
                            const currentIndex = icons.indexOf(block.content.icon || '💡')
                            const nextIcon = icons[(currentIndex + 1) % icons.length]
                            updateBlockContent(block.id, { ...block.content, icon: nextIcon })
                        }}
                    />
                )
            case 'toggle':
                return (
                    <ToggleBlock
                        {...commonProps}
                        value={block.content.toggleTitle || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, { ...block.content, toggleTitle: e.target.value })
                        }
                        toggleContent={block.content.toggleContent || ''}
                        onToggleContentChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            updateBlockContent(block.id, { ...block.content, toggleContent: e.target.value })
                        }
                        isOpen={block.content.isOpen || false}
                        onToggle={() =>
                            updateBlockContent(block.id, { ...block.content, isOpen: !block.content.isOpen })
                        }
                    />
                )
            case 'image':
                return (
                    <ImageBlock
                        {...commonProps}
                        blockId={block.id}
                        url={block.content.url || ''}
                        caption={block.content.caption || ''}
                        onCaptionChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, { ...block.content, caption: e.target.value })
                        }
                        onUpload={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const file = e.target.files?.[0]
                            if (file) {
                                const reader = new FileReader()
                                reader.onloadend = () => {
                                    updateBlockContent(block.id, {
                                        ...block.content,
                                        url: reader.result as string,
                                        alt: file.name,
                                    })
                                }
                                reader.readAsDataURL(file)
                            }
                        }}
                    />
                )
            case 'table':
                return (
                    <TableBlock
                        {...commonProps}
                        headers={block.content.headers || [1, 2, 3].map((n) => t('documents.blocks.columnLabel', { number: n }))}
                        rows={block.content.rows || [['', '', ''], ['', '', '']]}
                        onHeaderChange={(index: number, value: string) => {
                            const newHeaders = [...(block.content.headers || [])]
                            newHeaders[index] = value
                            updateBlockContent(block.id, { ...block.content, headers: newHeaders })
                        }}
                        onCellChange={(rowIndex: number, cellIndex: number, value: string) => {
                            const newRows = [...(block.content.rows || [])]
                            newRows[rowIndex][cellIndex] = value
                            updateBlockContent(block.id, { ...block.content, rows: newRows })
                        }}
                        onAddRow={() => {
                            const newRows = [...(block.content.rows || []), Array(block.content.headers?.length || 3).fill('')]
                            updateBlockContent(block.id, { ...block.content, rows: newRows })
                        }}
                        onAddColumn={() => {
                            const newHeaders = [...(block.content.headers || []), t('documents.blocks.columnLabel', { number: (block.content.headers?.length || 0) + 1 })]
                            const newRows = (block.content.rows || []).map((row: string[]) => [...row, ''])
                            updateBlockContent(block.id, { ...block.content, headers: newHeaders, rows: newRows })
                        }}
                        onDeleteRow={(rowIndex: number) => {
                            const newRows = (block.content.rows || []).filter((_: string[], index: number) => index !== rowIndex)
                            updateBlockContent(block.id, { ...block.content, rows: newRows })
                        }}
                    />
                )
            case 'link':
                return (
                    <LinkBlock
                        {...commonProps}
                        url={block.content.url || ''}
                        linkTitle={block.content.linkTitle || ''}
                        onUrlChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, { ...block.content, url: e.target.value })
                        }
                        onTitleChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, { ...block.content, linkTitle: e.target.value })
                        }
                    />
                )
            case 'bookmark':
                return (
                    <BookmarkBlock
                        {...commonProps}
                        url={block.content.url || ''}
                        bookmarkTitle={block.content.bookmarkTitle || ''}
                        description={block.content.description || ''}
                        bookmarkImage={block.content.bookmarkImage || ''}
                        onUrlChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, { ...block.content, url: e.target.value })
                        }
                    />
                )
            case 'date':
                return (
                    <DateBlock
                        {...commonProps}
                        date={block.content.date || ''}
                        reminder={block.content.reminder || false}
                        onDateChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, { ...block.content, date: e.target.value })
                        }
                        onReminderToggle={() =>
                            updateBlockContent(block.id, { ...block.content, reminder: !block.content.reminder })
                        }
                    />
                )
            case 'tag':
                return (
                    <TagBlock
                        {...commonProps}
                        tagColor={block.content.tagColor || 'gray'}
                        onColorChange={(color: string) =>
                            updateBlockContent(block.id, { ...block.content, tagColor: color })
                        }
                    />
                )
            case 'video':
                return (
                    <VideoBlock
                        {...commonProps}
                        url={block.content.url || ''}
                        onUrlChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, { ...block.content, url: e.target.value })
                        }
                    />
                )
            case 'file':
                return (
                    <FileBlock
                        {...commonProps}
                        blockId={block.id}
                        fileName={block.content.fileName || ''}
                        fileSize={block.content.fileSize || 0}
                        onUpload={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const file = e.target.files?.[0]
                            if (file) {
                                const reader = new FileReader()
                                reader.onloadend = () => {
                                    updateBlockContent(block.id, {
                                        ...block.content,
                                        url: reader.result as string,
                                        fileName: file.name,
                                        fileSize: file.size,
                                        fileType: file.type,
                                    })
                                }
                                reader.readAsDataURL(file)
                            }
                        }}
                    />
                )
            case 'equation':
                return (
                    <EquationBlock
                        {...commonProps}
                        value={block.content.latex || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateBlockContent(block.id, { ...block.content, latex: e.target.value })
                        }
                    />
                )
            default:
                return null
        }
    }

    if (status === 'loading' || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 dark:border-outline-variant border-t-blue-600 dark:border-t-secondary"></div>
            </div>
        )
    }

    if (!page) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-on-surface mb-2">
                        {t('documents.notFound')}
                    </h3>
                    <Link href="/dashboard" className="text-blue-600 dark:text-secondary hover:text-blue-700 dark:hover:text-secondary-dim">
                        {t('documents.backToDashboard')}
                    </Link>
                </div>
            </div>
        )
    }

    const breadcrumbs = [
        { label: t('nav.dashboard'), href: '/dashboard' },
        { label: t('documents.workspaceFallback'), href: `/workspaces/${page.workspaceId}` },
        { label: page.title || t('documents.untitled'), href: `/pages/${page.id}` },
    ]

    return (
        <AppShell
            workspace={{ id: page.workspaceId, name: page.workspace?.name || t('documents.workspaceFallback') }}
            currentPage={{ id: page.id, title: page.title }}
            breadcrumbs={breadcrumbs}
        >
            <div className="flex h-full bg-surface-bright">
                {/* Pages Sidebar */}
                <PagesSidebar
                    workspaceId={page.workspaceId}
                    currentPageId={page.id}
                    isAdmin={accessLevel === 'ADMIN'}
                    onCreatePage={async () => {
                        const res = await fetch('/api/pages', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: t('documents.untitled'), workspaceId: page.workspaceId }),
                        });
                        if (res.ok) {
                            const data = await res.json();
                            router.push(`/pages/${data.page.id}`);
                        }
                    }}
                />

                {/* Main Editor Area */}
                <main className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 px-4 md:px-12 lg:px-24 py-16 bg-gray-100 dark:bg-surface-container ${showComments ? 'mr-96' : ''}`}>
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-white dark:bg-surface-container-lowest rounded-xl px-12 py-12 min-h-[calc(100vh-8rem)]">
                        {/* Export & Share Toolbar */}
                        <ExportShareToolbar
                            title={title}
                            blocks={blocks}
                            pageId={page.id}
                            workspaceId={page.workspaceId}
                            isPublic={page.isPublic ?? false}
                            isAdmin={accessLevel === 'ADMIN'}
                        />

                        {/* Page Icon */}
                        {page.icon && (
                            <div className="mb-6 text-6xl">{page.icon}</div>
                        )}

                        {/* Read-only banner */}
                        {accessLevel === 'VIEW' && (
                            <div className="mb-6 flex items-center gap-2 px-4 py-2.5 bg-surface-container-high rounded-lg text-sm text-on-surface-variant">
                                <span>👁</span>
                                <span>{t('documents.viewOnlyBanner')}</span>
                            </div>
                        )}

                        {/* Page Title */}
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => { if (accessLevel !== 'VIEW') setTitle(e.target.value) }}
                            readOnly={accessLevel === 'VIEW'}
                            placeholder={t('documents.untitled')}
                            className="w-full text-[2.75rem] font-black tracking-tighter leading-tight text-on-surface bg-transparent focus:outline-none mb-4 placeholder:text-on-surface-variant/30"
                        />

                        {/* AI Document Generator */}
                        {accessLevel !== 'VIEW' && blocks.length === 0 && (
                            <div className="mb-10">
                                {showAiPromptInput ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-secondary/30 bg-secondary/5 focus-within:border-secondary focus-within:bg-secondary/10 transition-colors">
                                            <span className="material-symbols-outlined text-secondary text-base leading-none flex-shrink-0" style={{ fontVariationSettings: 'FILL 1' }}>auto_awesome</span>
                                            <input
                                                ref={aiPromptRef}
                                                type="text"
                                                value={aiPromptValue}
                                                onChange={e => setAiPromptValue(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') generateFromPrompt()
                                                    if (e.key === 'Escape') { setShowAiPromptInput(false); setAiPromptValue('') }
                                                }}
                                                placeholder={t('documents.aiPromptPlaceholder')}
                                                className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                                                autoFocus
                                            />
                                            {isGeneratingFromPrompt ? (
                                                <div className="h-4 w-4 rounded-full border-2 border-secondary border-t-transparent animate-spin flex-shrink-0" />
                                            ) : (
                                                <button
                                                    onClick={generateFromPrompt}
                                                    disabled={!aiPromptValue.trim()}
                                                    className="text-secondary disabled:opacity-40 flex-shrink-0"
                                                >
                                                    <span className="material-symbols-outlined text-base leading-none">send</span>
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-on-surface-variant/60 pl-1">{t('documents.aiPromptHint')}</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <button
                                            onClick={() => { setShowAiPromptInput(true) }}
                                            disabled={isGeneratingOutline}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/10 text-secondary text-sm font-medium hover:bg-secondary/20 transition-colors disabled:opacity-60"
                                        >
                                            <span className="material-symbols-outlined text-base leading-none" style={{ fontVariationSettings: 'FILL 1' }}>edit_note</span>
                                            {t('documents.writeWithAi')}
                                        </button>
                                        {title.trim() && (
                                            <button
                                                onClick={generateOutline}
                                                disabled={isGeneratingOutline}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/10 text-secondary text-sm font-medium hover:bg-secondary/20 transition-colors disabled:opacity-60"
                                            >
                                                {isGeneratingOutline ? (
                                                    <><div className="h-4 w-4 rounded-full border-2 border-secondary border-t-transparent animate-spin" />{t('documents.generatingOutline')}</>
                                                ) : (
                                                    <><span className="material-symbols-outlined text-base leading-none" style={{ fontVariationSettings: 'FILL 1' }}>auto_awesome</span>{t('documents.generateOutlineWithAi')}</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Blocks */}
                        <div className="space-y-2" ref={contentRef}>
                            {blocks.map((block, index) => (
                                <div
                                    key={block.id}
                                    draggable
                                    onDragStart={(e) => handleBlockDragStart(e, block.id)}
                                    onDragOver={handleBlockDragOver}
                                    onDrop={(e) => handleBlockDrop(e, block.id)}
                                    className="group relative flex items-start gap-3 py-2 px-2 -mx-2 hover:bg-surface-container-low/50 rounded-lg transition-colors"
                                >
                                    {/* Drag Handle — hidden for view-only */}
                                    {accessLevel !== 'VIEW' && (
                                        <div className="flex-shrink-0 pt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                            <div
                                                className="cursor-grab"
                                                onContextMenu={(e) => handleBlockMenuClick(e, block.id)}
                                                onClick={(e) => handleBlockMenuClick(e, block.id)}
                                            >
                                                <GripVertical className="h-5 w-5 text-on-surface-variant" />
                                            </div>
                                            {/* Tone rewriter trigger */}
                                            {['text','heading1','heading2','heading3','bullet','numbered','quote'].includes(block.type) && (
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setSelectedBlockId(selectedBlockId === block.id ? null : block.id)}
                                                        className="p-0.5 rounded hover:bg-surface-container-highest"
                                                        title={t('documents.rewriteToneTitle')}
                                                    >
                                                        {isToneLoading && selectedBlockId === block.id
                                                            ? <div className="h-3.5 w-3.5 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
                                                            : <span className="material-symbols-outlined text-sm text-secondary leading-none" style={{ fontVariationSettings: 'FILL 1' }}>auto_awesome</span>
                                                        }
                                                    </button>
                                                    {selectedBlockId === block.id && !isToneLoading && (
                                                        <div className="absolute left-0 top-6 z-30 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-xl py-1 w-36">
                                                            {['formal','casual','persuasive','concise'].map(tone => (
                                                                <button
                                                                    key={tone}
                                                                    onClick={() => rewriteBlockTone(block.id, tone)}
                                                                    className="w-full text-left px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container-low capitalize transition-colors"
                                                                >
                                                                    {t(`documents.tones.${tone}` as Parameters<typeof t>[0])}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Block Content */}
                                    <div
                                        className="flex-1 min-w-0"
                                        // Scoped to this block's own subtree, so blocks that
                                        // render several fields cannot shift the target.
                                        ref={(el) =>
                                            registerBlockRef(
                                                block.id,
                                                el?.querySelector<HTMLElement>('textarea, input[type="text"]') ?? null
                                            )
                                        }
                                    >
                                        {renderBlock(block)}
                                    </div>

                                    {/* Delete Button — hidden for view-only */}
                                    {accessLevel !== 'VIEW' && (
                                        <button
                                            onClick={() => deleteBlock(block.id)}
                                            className="flex-shrink-0 pt-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-on-surface-variant hover:text-error"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Block Button — hidden for view-only */}
                        {accessLevel !== 'VIEW' && (
                            <div className="mt-8">
                                <button
                                    onClick={() => setShowBlockMenu(!showBlockMenu)}
                                    className="flex items-center gap-2 px-4 py-3 text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-container-low rounded-lg transition-all border border-transparent hover:border-gray-200 dark:hover:border-outline-variant/30"
                                >
                                    <Plus className="h-5 w-5" />
                                    <span className="text-sm font-medium">{t('documents.addBlockButton')}</span>
                                </button>
                            </div>
                        )}

                        {/* Block Menu */}
                        {showBlockMenu && (
                            <div className="mt-4 bg-white dark:bg-surface-dim rounded-xl shadow-xl border border-gray-200 dark:border-outline-variant/30 p-4 max-h-96 overflow-y-auto custom-scrollbar">
                                {Object.entries(getBlockTypes(t).reduce((acc, block) => {
                                    const category = block.category || t('documents.categories.basic')
                                    if (!acc[category]) {
                                        acc[category] = []
                                    }
                                    acc[category].push(block)
                                    return acc
                                }, {} as Record<string, ReturnType<typeof getBlockTypes>>)).map(([category, items]) => (
                                    <div key={category} className="mb-4 last:mb-0">
                                        <div className="px-2 py-1 mb-2">
                                            <p className="text-xs font-semibold text-gray-500 dark:text-on-surface-variant">{t('documents.blocksGroupLabel', { category })}</p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {items.map((item) => (
                                                <button
                                                    key={item.type}
                                                    onClick={() => addBlock(item.type)}
                                                    className="flex flex-col items-center p-3 hover:bg-gray-50 dark:hover:bg-surface-container-low rounded-lg transition-all group"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-surface-container-high flex items-center justify-center mb-2 group-hover:bg-blue-50 dark:group-hover:bg-surface-container-highest transition-colors">
                                                        <item.icon className="h-5 w-5 text-gray-600 dark:text-on-surface-variant group-hover:text-blue-600 dark:group-hover:text-secondary transition-colors" />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-700 dark:text-on-surface">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Slash Command Menu */}
                        {slashMenu && (
                            <SlashCommandMenu
                                position={slashMenu.position}
                                onSelect={(type) => addBlock(type, slashMenu.blockId)}
                                onClose={() => setSlashMenu(null)}
                            />
                        )}

                        {/* Block Context Menu */}
                        {blockContextMenu && (
                            <BlockContextMenu
                                position={blockContextMenu.position}
                                onClose={() => setBlockContextMenu(null)}
                                onDelete={() => {
                                    deleteBlock(blockContextMenu.blockId)
                                    setBlockContextMenu(null)
                                }}
                                onDuplicate={() => duplicateBlock(blockContextMenu.blockId)}
                                onTransform={(type) => transformBlock(blockContextMenu.blockId, type)}
                                currentType={blocks.find(b => b.id === blockContextMenu.blockId)?.type || 'text'}
                            />
                        )}

                        {/* Hidden print area — visible only during window.print() */}
                        {typeof document !== 'undefined' ? createPortal(
                            <div className="print-area hidden" aria-hidden="true">
                                <h1>{title}</h1>
                                {blocks.map(block => <PrintBlock key={block.id} block={block} />)}
                            </div>,
                            document.body
                        ) : null}

                        {/* Save Status */}
                        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 flex flex-col items-end gap-2">
                        {aiError && (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border bg-error/10 border-error/30">
                                <Info className="h-4 w-4 text-error flex-shrink-0" />
                                <span className="text-sm text-error">{aiError}</span>
                                <button
                                    onClick={() => setAiError(null)}
                                    className="ml-1 text-error/70 hover:text-error transition-colors"
                                    aria-label={t('documents.dismiss')}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                        <div
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border transition-all ${
                                saveError
                                    ? 'bg-error/10 border-error/30'
                                    : 'bg-surface-container-lowest border-outline-variant/20'
                            }`}
                        >
                            {saveError ? (
                                <>
                                    <Info className="h-4 w-4 text-error flex-shrink-0" />
                                    <span className="text-sm text-error">{saveError}</span>
                                </>
                            ) : isSaving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-outline-variant border-t-secondary"></div>
                                    <span className="text-sm text-on-surface-variant">{t('documents.saving')}</span>
                                </>
                            ) : isDirty ? (
                                <>
                                    <Save className="h-4 w-4 text-on-surface-variant" />
                                    <span className="text-sm text-on-surface-variant">{t('documents.unsavedChanges')}</span>
                                </>
                            ) : accessLevel === 'VIEW' ? (
                                <span className="text-sm text-on-surface-variant">{t('documents.viewOnly')}</span>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 text-secondary" />
                                    <span className="text-sm text-on-surface-variant">{t('documents.saved')}</span>
                                </>
                            )}
                        </div>
                        </div>{/* end status stack */}
                        </div>{/* end white card */}
                    </div>{/* end max-w-3xl */}
                </main>

                {/* Comments Panel */}
                {showComments && (
                    <aside className="fixed right-0 top-14 bottom-0 w-96 bg-surface-container-lowest border-l border-outline-variant/20 flex flex-col z-40 shadow-xl">
                        {/* Comments Header */}
                        <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between">
                            <h3 className="font-semibold text-on-surface">{t('documents.commentsTitle')}</h3>
                            <button
                                onClick={() => setShowComments(false)}
                                className="p-2 hover:bg-surface-container-low rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5 text-on-surface-variant" />
                            </button>
                        </div>

                        {/* Comments List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                            {comments.length === 0 ? (
                                <div className="text-center py-12 text-on-surface-variant">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-40" />
                                    <p className="text-sm">{t('documents.commentsEmpty')}</p>
                                </div>
                            ) : (
                                comments.map((comment) => (
                                    <div key={comment.id} className="bg-surface-container-low rounded-xl p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-secondary text-xs font-bold">
                                                {(comment.user.name || comment.user.email).slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-on-surface">{comment.user.name || comment.user.email}</p>
                                                <p className="text-xs text-on-surface-variant">
                                                    {formatDate(comment.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-on-surface leading-relaxed">{comment.content}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Comment Form */}
                        <div className="p-5 border-t border-outline-variant/20">
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    placeholder={t('documents.commentPlaceholder')}
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addComment()}
                                    className="flex-1 px-4 py-3 bg-surface-container-low rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
                                />
                                <button
                                    onClick={addComment}
                                    className="px-4 py-3 bg-secondary text-on-secondary rounded-xl hover:opacity-90 transition-colors"
                                >
                                    <MessageSquare className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </aside>
                )}

                {/* Comments Toggle Button */}
                <button
                    onClick={() => setShowComments(!showComments)}
                    className="fixed right-6 bottom-24 p-3 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 transition-all z-30 hover:shadow-xl"
                >
                    <MessageSquare className="h-5 w-5 text-on-surface-variant" />
                </button>
            </div>
        </AppShell>
    )
}

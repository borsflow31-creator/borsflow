'use client'
import { useI18n } from '@/i18n/I18nProvider';

interface ContentBlockProps {
    type: 'heading1' | 'paragraph' | 'bullet' | 'code'
    content?: string
    children?: React.ReactNode
}

export default function ContentBlock({ type, content, children }: ContentBlockProps) {
    const { t } = useI18n();
    return (
        <div className="relative group mb-6">
            {/* Drag Handle */}
            <div className="absolute -left-8 opacity-0 group-hover:opacity-100 text-outline-variant transition-opacity cursor-grab">
                <span className="material-symbols-outlined text-sm">drag_indicator</span>
            </div>

            {type === 'heading1' && (
                <h1 className="text-[2.75rem] font-black tracking-tighter leading-tight text-on-surface">
                    {content}
                </h1>
            )}

            {type === 'paragraph' && (
                <p className="text-[1rem] leading-[1.6] text-on-surface-variant relative">
                    {content}
                    {/* Real-time Cursor: Alice */}
                    <span className="inline-block w-[2px] h-6 bg-secondary relative top-1.5">
                        <span className="cursor-name bg-secondary text-white">{t('misc.aliceEditing')}</span>
                    </span>
                </p>
            )}

            {type === 'bullet' && (
                <ul className="space-y-4 mb-8 text-on-surface-variant">
                    {children}
                </ul>
            )}

            {type === 'code' && (
                <div className="rounded-lg bg-slate-900 p-6 font-mono text-sm text-slate-300 relative group">
                    <div className="flex justify-between items-center mb-4 text-xs text-slate-500">
                        <span>tailwind.config.js</span>
                        <span className="material-symbols-outlined text-base">content_copy</span>
                    </div>
                    <pre><code>{content}</code></pre>
                </div>
            )}
        </div>
    )
}

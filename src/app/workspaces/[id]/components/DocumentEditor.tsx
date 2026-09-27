'use client'

import ContentBlock from './ContentBlock'
import SlashCommandMenu from './SlashCommandMenu'

export default function DocumentEditor() {
    return (
        <section className="flex-1 bg-surface-bright min-h-screen px-4 md:px-12 lg:px-24 py-16 max-w-5xl">
            <div className="bg-surface-container-lowest rounded-xl p-12 min-h-[1200px] relative">
                {/* Page Breadcrumbs */}
                <div className="mb-10 text-on-surface-variant text-xs tracking-widest uppercase">
                    Product / Q4 Strategy / Architecture 2.0
                </div>

                {/* Block: Heading 1 */}
                <ContentBlock type="heading1" content="Redefining Digital Workspace Architecture" />

                {/* Block: Paragraph with Active Cursor */}
                <ContentBlock type="paragraph" content="In the landscape of modern productivity, the interface serves as more than a container; it is a mental model. Our goal with the 2.0 architecture is to eliminate structural friction by leveraging tonal depth over rigid boundaries. We move beyond the 'SaaS template' by treating the UI as a series of high-end editorial planes." />

                {/* Block: Bulleted List */}
                <ContentBlock type="bullet">
                    <li className="flex items-start group relative">
                        <div className="absolute -left-8 opacity-0 group-hover:opacity-100 text-outline-variant transition-opacity cursor-grab">
                            <span className="material-symbols-outlined text-sm">drag_indicator</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-secondary-dim mt-2 mr-4 shrink-0"></span>
                        <span>Prioritizing negative space (6 to 10 on the spacing scale) as a primary navigational guide.</span>
                    </li>
                    <li className="flex items-start group relative">
                        <div className="absolute -left-8 opacity-0 group-hover:opacity-100 text-outline-variant transition-opacity cursor-grab">
                            <span className="material-symbols-outlined text-sm">drag_indicator</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-secondary-dim mt-2 mr-4 shrink-0"></span>
                        <span>Implementing Glassmorphism (80% opacity, 20px blur) for high-level overlays.</span>
                    </li>
                    <li className="flex items-start group relative">
                        <div className="absolute -left-8 opacity-0 group-hover:opacity-100 text-outline-variant transition-opacity cursor-grab">
                            <span className="material-symbols-outlined text-sm">drag_indicator</span>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-secondary-dim mt-2 mr-4 shrink-0"></span>
                        <span>Rejecting the &apos;No-Line&apos; rule except for critical accessibility touchpoints.</span>
                    </li>
                </ContentBlock>

                {/* Block: Code Block */}
                <ContentBlock
                    type="code"
                    content={`module.exports = {
  theme: {
    extend: {
      colors: {
        'surface': '#f8f9fa',
        'secondary': '#4a4bd7'
      }
    }
  }
}`}
                />

                {/* Slash Command Menu (Visible) */}
                <SlashCommandMenu onInsertBlock={() => {}} />
            </div>
        </section>
    )
}

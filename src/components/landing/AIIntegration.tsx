'use client'

import React from 'react'
import { useI18n } from '@/i18n/I18nProvider'

export const AIIntegration = () => {
    const { t } = useI18n()

    /* Verified against src/lib/ai/agent/tools.ts: the assistant's read tools, and
       the records each one actually queries. Identifiers and table names are real
       data, which is the one job the mono face is for. (It can also create pages,
       tasks, leads and meetings when asked, for roles that may edit.) */
    const TOOLS: { tool: string; reads: string; answers: string }[] = [
        { tool: 'search_pages · read_page', reads: 'Page', answers: t('landing.aiIntegration.answerPages') },
        { tool: 'search_leads', reads: 'Lead', answers: t('landing.aiIntegration.answerLeads') },
        { tool: 'list_tasks', reads: 'KanbanCard', answers: t('landing.aiIntegration.answerTasks') },
        { tool: 'get_financials', reads: 'Quote, Invoice', answers: t('landing.aiIntegration.answerFinancials') },
        { tool: 'list_meetings', reads: 'Meeting', answers: t('landing.aiIntegration.answerMeetings') },
        { tool: 'search_products', reads: 'Product', answers: t('landing.aiIntegration.answerProducts') },
        { tool: 'list_templates', reads: 'UniversalTemplate', answers: t('landing.aiIntegration.answerTemplates') },
    ]

    return (
        <section id="assistant" className="py-16 sm:py-24 scroll-mt-24 border-t border-[var(--n-border)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-text)]">{t('landing.aiIntegration.heading')}</h2>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        {t('landing.aiIntegration.lead')}
                    </p>
                </div>

                {/* On a plate, not on hairlines: this is the one place in the middle
                    of the page that carries material. */}
                <div className="mt-12 taste-plinth overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <caption className="sr-only">
                            {t('landing.aiIntegration.tableCaption')}
                        </caption>
                        <thead>
                            <tr className="border-b border-[var(--n-border-strong)]">
                                <th scope="col" className="py-4 pl-6 sm:pl-8 pr-4 text-xs font-medium text-[var(--n-text)]">
                                    {t('landing.aiIntegration.colTool')}
                                </th>
                                <th scope="col" className="py-4 px-4 text-xs font-medium text-[var(--n-text)]">
                                    {t('landing.aiIntegration.colReads')}
                                </th>
                                <th
                                    scope="col"
                                    className="py-4 pr-6 sm:pr-8 pl-4 text-xs font-medium text-[var(--n-text)]"
                                >
                                    {t('landing.aiIntegration.colAnswers')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {TOOLS.map(({ tool, reads, answers }) => (
                                <tr key={tool} className="border-b border-[var(--n-border)] last:border-0">
                                    <th
                                        scope="row"
                                        className="py-4 pl-6 sm:pl-8 pr-4 align-top t-data text-xs font-normal text-[var(--n-emerald)] whitespace-nowrap"
                                    >
                                        {tool}
                                    </th>
                                    <td className="py-4 px-4 align-top t-data text-xs text-[var(--n-text)] whitespace-nowrap">
                                        {reads}
                                    </td>
                                    <td className="py-4 pr-6 sm:pr-8 pl-4 align-top text-xs leading-relaxed text-[var(--n-muted)]">
                                        {answers}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}

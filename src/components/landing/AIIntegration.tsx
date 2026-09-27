import React from 'react'

/* Verified against src/app/api/ai/chat/route.ts: these are the five tools the
   assistant has, and the records each one actually queries. Identifiers and
   table names are real data, which is the one job the mono face is for. */
const TOOLS: { tool: string; reads: string; answers: string }[] = [
    { tool: 'search_pages', reads: 'Page', answers: 'Where a document is and what it says' },
    { tool: 'get_crm_leads', reads: 'Lead', answers: 'Which deals sit at which stage, and for how much' },
    { tool: 'get_financials', reads: 'Quote, Invoice', answers: 'What was billed, what was paid, what is overdue' },
    { tool: 'get_meetings', reads: 'Meeting', answers: 'What is booked, with whom, against which deal' },
    { tool: 'list_templates', reads: 'UniversalTemplate', answers: 'What you can start from' },
]

export const AIIntegration = () => {
    return (
        <section id="assistant" className="py-16 sm:py-24 scroll-mt-24 border-t border-[var(--n-border)]">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                <div className="max-w-3xl">
                    <h2 className="font-display t-h2 text-[var(--n-text)]">Ask your workspace a question.</h2>
                    <p className="mt-5 t-lead measure text-[var(--n-muted)]">
                        The assistant does not answer from a summary of your data. It queries the records directly, and
                        it can only reach what your role already lets you see.
                    </p>
                </div>

                {/* On a plate, not on hairlines: this is the one place in the middle
                    of the page that carries material. */}
                <div className="mt-12 taste-plinth overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <caption className="sr-only">
                            The five tools the assistant can call, the records each reads, and what each can answer
                        </caption>
                        <thead>
                            <tr className="border-b border-[var(--n-border-strong)]">
                                <th scope="col" className="py-4 pl-6 sm:pl-8 pr-4 text-xs font-medium text-[var(--n-text)]">
                                    Tool
                                </th>
                                <th scope="col" className="py-4 px-4 text-xs font-medium text-[var(--n-text)]">
                                    Reads
                                </th>
                                <th
                                    scope="col"
                                    className="py-4 pr-6 sm:pr-8 pl-4 text-xs font-medium text-[var(--n-text)]"
                                >
                                    Answers
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

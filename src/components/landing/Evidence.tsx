import React from 'react'
import Image from 'next/image'

type Variant = 'editor' | 'financials'

/* One block per instance, so the two captures can be placed apart in the
   scroll instead of stacked. Each carries its own framing: the editor capture
   is inset in the reading column, the financials capture breaks the left edge.
   Alternating a mirrored module read as one component twice, not two ideas. */
const BLOCKS: Record<Variant, {
    title: string
    body: string
    src: string
    alt: string
    w: number
    h: number
}> = {
    editor: {
        title: 'The scope lives where the deal lives',
        body: 'Twenty-two block types, nested as deep as the project goes. Comment in threads, grant view or edit to one person, publish a read-only link for the client.',
        src: '/shots/pages.webp',
        alt: 'A project scope open in the BorsFlow editor: a callout, a Deliverables heading, and a checklist with two items completed.',
        w: 2160,
        h: 1350,
    },
    financials: {
        title: 'Quotes become invoices, and invoices get paid',
        body: 'Accepted quotes convert in one step and carry the client, the line items and the tax across. Take payment by Stripe link or Connect, or record a bank transfer by hand — partial payments draw the balance down as they land.',
        src: '/shots/invoices.webp',
        alt: 'The BorsFlow invoice list: one invoice marked Paid at 100%, another marked Sent at 30% paid with the amount still due.',
        w: 2160,
        h: 1058,
    },
}

export const Evidence = ({ variant }: { variant: Variant }) => {
    const b = BLOCKS[variant]
    const bleedLeft = variant === 'financials'

    if (bleedLeft) {
        return (
            <section id={variant} className="py-16 sm:py-24 scroll-mt-24 overflow-hidden">
                <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
                    <div className="max-w-2xl ml-auto">
                        <h2 className="font-display t-sub text-[var(--n-text)]">{b.title}</h2>
                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--n-muted)]">{b.body}</p>
                    </div>
                </div>
                {/* Breaks the opposite edge from the hero, so the two bleeds read
                    as a pair of decisions rather than one repeated trick. */}
                <div className="mt-10 pr-5 sm:pr-8 lg:pr-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]">
                    <div className="plate-raster taste-plinth overflow-hidden p-1.5 sm:p-2">
                        <Image
                            src={b.src}
                            alt={b.alt}
                            width={b.w}
                            height={b.h}
                            sizes="(max-width: 1024px) 100vw, 88vw"
                            className="w-full h-auto rounded-[0.9rem]"
                        />
                    </div>
                </div>
            </section>
        )
    }

    return (
        <section id={variant} className="py-16 sm:py-24 scroll-mt-24">
            <div className="max-w-5xl mx-auto px-5 sm:px-8">
                <div className="max-w-2xl">
                    <h2 className="font-display t-sub text-[var(--n-text)]">{b.title}</h2>
                    <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--n-muted)]">{b.body}</p>
                </div>
                <div className="plate-reveal plate-raster taste-plinth overflow-hidden p-1.5 sm:p-2 mt-10">
                    <Image
                        src={b.src}
                        alt={b.alt}
                        width={b.w}
                        height={b.h}
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        className="w-full h-auto rounded-[0.9rem]"
                    />
                </div>
            </div>
        </section>
    )
}

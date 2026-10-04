/**
 * Emits a JSON-LD block. Server-rendered, so the graph is in the HTML the
 * crawler gets rather than something it has to execute JavaScript to find.
 *
 * `<` is escaped because the graph carries page copy: an apostrophe is fine,
 * but a literal "</script>" inside a string would close the tag early and
 * spill the rest of the graph into the document as markup.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\u003c') }}
        />
    )
}

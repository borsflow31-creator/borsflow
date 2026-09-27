interface Block {
    id: string
    type: string
    content: any
    order: number
}

// ─── Markdown ────────────────────────────────────────────────

export function blocksToMarkdown(title: string, blocks: Block[]): string {
    const lines: string[] = [`# ${title}`, '']

    for (const block of blocks) {
        const c = block.content ?? {}
        const text = c.text ?? ''

        switch (block.type) {
            case 'text':
                lines.push(text || '')
                break
            case 'heading1':
                lines.push(`# ${text}`)
                break
            case 'heading2':
                lines.push(`## ${text}`)
                break
            case 'heading3':
                lines.push(`### ${text}`)
                break
            case 'bullet':
                lines.push(`- ${text}`)
                break
            case 'numbered':
                lines.push(`1. ${text}`)
                break
            case 'todo':
                lines.push(`- [${c.checked ? 'x' : ' '}] ${text}`)
                break
            case 'code':
                lines.push('```', text, '```')
                break
            case 'quote':
                lines.push(`> ${text}`)
                break
            case 'divider':
                lines.push('---')
                break
            case 'callout': {
                const icon = c.icon ? `${c.icon} ` : ''
                lines.push(`> ${icon}${text}`)
                break
            }
            case 'toggle':
                lines.push(`**${c.toggleTitle ?? ''}**`, '', `> ${c.toggleContent ?? ''}`)
                break
            case 'image':
                lines.push(`![${c.caption ?? ''}](${c.url ?? ''})`)
                break
            case 'table': {
                const headers: string[] = c.headers ?? []
                const rows: string[][] = c.rows ?? []
                if (headers.length > 0) {
                    lines.push(`| ${headers.join(' | ')} |`)
                    lines.push(`| ${headers.map(() => '---').join(' | ')} |`)
                    for (const row of rows) {
                        lines.push(`| ${row.join(' | ')} |`)
                    }
                }
                break
            }
            case 'link':
                lines.push(`[${c.linkTitle ?? c.url ?? ''}](${c.url ?? ''})`)
                break
            case 'bookmark':
                lines.push(`[${c.bookmarkTitle ?? c.url ?? ''}](${c.url ?? ''})`)
                if (c.description) lines.push(`> ${c.description}`)
                break
            case 'video':
                lines.push(`[Video](${c.url ?? ''})`)
                break
            case 'file':
                lines.push(`[${c.fileName ?? 'File'}](${c.url ?? ''})`)
                break
            case 'equation':
                lines.push(`$$${c.latex ?? ''}$$`)
                break
            case 'tag':
                lines.push(`\`${text}\``)
                break
            case 'date':
                lines.push(`📅 ${text}`)
                break
            default:
                if (text) lines.push(text)
        }

        lines.push('')
    }

    return lines.join('\n')
}

// ─── Blob download ───────────────────────────────────────────

export function downloadBlob(content: string | Blob, filename: string, mimeType = 'application/octet-stream') {
    const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

// ─── Word (.docx) ────────────────────────────────────────────

export async function blocksToDocx(title: string, blocks: Block[]): Promise<Blob> {
    const {
        Document, Paragraph, TextRun, HeadingLevel,
        Table, TableRow, TableCell, WidthType,
        ExternalHyperlink, Packer, BorderStyle,
        AlignmentType,
    } = await import('docx')

    const children: any[] = [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: title, bold: true })] }),
        new Paragraph({}),
    ]

    for (const block of blocks) {
        const c = block.content ?? {}
        const text: string = c.text ?? ''

        switch (block.type) {
            case 'text':
                children.push(new Paragraph({ children: [new TextRun(text)] }))
                break
            case 'heading1':
                children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text }))
                break
            case 'heading2':
                children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text }))
                break
            case 'heading3':
                children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, text }))
                break
            case 'bullet':
                children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(text)] }))
                break
            case 'numbered':
                children.push(new Paragraph({ numbering: { reference: 'default-numbering', level: 0 }, children: [new TextRun(text)] }))
                break
            case 'todo':
                children.push(new Paragraph({ children: [new TextRun(`${c.checked ? '☑' : '☐'} ${text}`)] }))
                break
            case 'code':
                children.push(new Paragraph({
                    children: [new TextRun({ text, font: 'Courier New', size: 18 })],
                    shading: { fill: 'F4F4F4' } as any,
                }))
                break
            case 'quote':
                children.push(new Paragraph({
                    indent: { left: 720 },
                    children: [new TextRun({ text, italics: true, color: '555555' })],
                    border: { left: { style: BorderStyle.SINGLE, size: 8, color: 'CCCCCC', space: 8 } },
                }))
                break
            case 'divider':
                children.push(new Paragraph({
                    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 1 } },
                    children: [],
                }))
                break
            case 'callout': {
                const icon = c.icon ? `${c.icon} ` : ''
                children.push(new Paragraph({
                    children: [new TextRun({ text: `${icon}${text}`, bold: false })],
                    shading: { fill: 'FFFBEA' } as any,
                    indent: { left: 360 },
                }))
                break
            }
            case 'toggle':
                children.push(
                    new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(c.toggleTitle ?? '')] }),
                    new Paragraph({ indent: { left: 360 }, children: [new TextRun({ text: c.toggleContent ?? '', italics: true })] }),
                )
                break
            case 'image':
                children.push(new Paragraph({ children: [new TextRun({ text: `[Image${c.caption ? ': ' + c.caption : ''}]`, italics: true, color: '888888' })] }))
                break
            case 'table': {
                const headers: string[] = c.headers ?? []
                const rows: string[][] = c.rows ?? []
                if (headers.length > 0) {
                    const tableRows = [
                        new TableRow({
                            children: headers.map((h: string) =>
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })
                            ),
                        }),
                        ...rows.map((row: string[]) =>
                            new TableRow({
                                children: row.map((cell: string) =>
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun(cell)] })] })
                                ),
                            })
                        ),
                    ]
                    children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }))
                    children.push(new Paragraph({}))
                }
                break
            }
            case 'link':
                children.push(new Paragraph({
                    children: [new ExternalHyperlink({
                        link: c.url ?? '',
                        children: [new TextRun({ text: c.linkTitle || c.url || '', style: 'Hyperlink' })],
                    })],
                }))
                break
            case 'bookmark':
                children.push(new Paragraph({
                    children: [new ExternalHyperlink({
                        link: c.url ?? '',
                        children: [new TextRun({ text: c.bookmarkTitle || c.url || '', style: 'Hyperlink' })],
                    })],
                }))
                if (c.description) {
                    children.push(new Paragraph({ indent: { left: 360 }, children: [new TextRun({ text: c.description, italics: true, color: '555555' })] }))
                }
                break
            case 'video':
                children.push(new Paragraph({ children: [new TextRun({ text: `[Video: ${c.url ?? ''}]`, italics: true, color: '888888' })] }))
                break
            case 'file':
                children.push(new Paragraph({ children: [new TextRun({ text: `[File: ${c.fileName ?? c.url ?? ''}]`, italics: true, color: '888888' })] }))
                break
            case 'equation':
                children.push(new Paragraph({ children: [new TextRun({ text: `∑ ${c.latex ?? ''}`, font: 'Courier New' })] }))
                break
            case 'tag':
                children.push(new Paragraph({ children: [new TextRun({ text, shading: { fill: 'E5E7EB' } as any })] }))
                break
            case 'date':
                children.push(new Paragraph({ children: [new TextRun(`📅 ${text}`)] }))
                break
            default:
                if (text) children.push(new Paragraph({ children: [new TextRun(text)] }))
        }
    }

    const doc = new Document({
        numbering: {
            config: [{
                reference: 'default-numbering',
                levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
            }],
        },
        sections: [{ children }],
    })

    return Packer.toBlob(doc)
}

// ─── PDF (print) ─────────────────────────────────────────────

export function triggerPrint() {
    window.print()
}

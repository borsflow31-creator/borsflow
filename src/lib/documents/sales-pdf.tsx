/**
 * Reservation form and contract PDFs.
 *
 * Rendered from a SalesDocument's frozen text, never from the live template: what
 * the buyer is shown, what they accept and what is on file must be the same words,
 * and the template can be edited at any time.
 *
 * Two renderings of one document:
 *
 *   the issued PDF       what is sent to the buyer and stored. Its SHA-256 is the
 *                        document's fingerprint; acceptance records that hash.
 *   the accepted copy    the same pages plus a final "electronic acceptance" page
 *                        stating who accepted, when, from where, and the fingerprint
 *                        of the issued file. Rendered on demand and never stored, so
 *                        the stored original stays byte-for-byte what was sent.
 *
 * Helvetica, like the quote and invoice PDFs: it has no Arabic or CJK glyphs, so a
 * template in those scripts would need an embedded font first.
 */

import React from 'react'
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'

export interface SalesPdfAcceptance {
  name: string
  at: Date | string
  ip?: string | null
  userAgent?: string | null
  /** SHA-256 of the issued PDF the buyer saw. */
  fileHash: string
}

export interface SalesPdfData {
  kind: 'reservation' | 'contract'
  number: string
  title: string
  workspaceName: string
  issuedAt: Date | string
  /** The merged text, frozen when the document was issued. */
  bodyText: string
  acceptance?: SalesPdfAcceptance | null
}

const INK = '#0d0e15'
const MUTED = '#52566b'
const HAIRLINE = '#d9dce6'

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: INK, lineHeight: 1.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  workspace: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  meta: { fontSize: 9, color: MUTED, textAlign: 'right' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 16 },
  paragraph: { marginBottom: 8 },
  signature: { marginTop: 28, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIRLINE },
  signatureLabel: { fontSize: 9, color: MUTED, marginBottom: 4 },
  line: { borderBottomWidth: 1, borderBottomColor: INK, height: 24, marginBottom: 4 },
  certTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  certRow: { flexDirection: 'row', marginBottom: 4 },
  certLabel: { width: 110, color: MUTED },
  certValue: { flex: 1 },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 8, color: MUTED, textAlign: 'center' },
})

/** Split frozen text into paragraphs on blank lines, keeping single line breaks. */
function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
}

function formatUtc(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function SalesPdf({ data }: { data: SalesPdfData }) {
  return (
    <Document title={`${data.title} ${data.number}`} author={data.workspaceName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.workspace}>{data.workspaceName}</Text>
          <View>
            <Text style={styles.meta}>{data.number}</Text>
            <Text style={styles.meta}>{formatUtc(data.issuedAt).slice(0, 10)}</Text>
          </View>
        </View>

        <Text style={styles.title}>{data.title}</Text>
        {paragraphs(data.bodyText).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        {/* The issued copy shows where acceptance happens; the accepted copy has its own page. */}
        {!data.acceptance && (
          <View style={styles.signature} wrap={false}>
            <Text style={styles.signatureLabel}>Accepted by the buyer (electronically, in the purchase space)</Text>
            <View style={styles.line} />
          </View>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${data.workspaceName} · ${data.number} · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>

      {data.acceptance && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.certTitle}>Electronic acceptance</Text>
          <Text style={styles.paragraph}>
            This page records the buyer&apos;s acceptance of document {data.number}. The fingerprint below identifies the exact
            file that was sent; the acceptance applies to that file and no other.
          </Text>
          <View style={{ marginTop: 12 }}>
            {[
              ['Accepted by', data.acceptance.name],
              ['Date and time', formatUtc(data.acceptance.at)],
              ['Network address', data.acceptance.ip || 'not recorded'],
              ['Device', data.acceptance.userAgent || 'not recorded'],
              ['File fingerprint (SHA-256)', data.acceptance.fileHash],
            ].map(([label, value]) => (
              <View key={label} style={styles.certRow}>
                <Text style={styles.certLabel}>{label}</Text>
                <Text style={styles.certValue}>{value}</Text>
              </View>
            ))}
          </View>
          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) => `${data.workspaceName} · ${data.number} · Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </Page>
      )}
    </Document>
  )
}

export async function renderSalesPdf(data: SalesPdfData): Promise<Buffer> {
  return renderToBuffer(<SalesPdf data={data} />)
}

export function salesPdfFilename(data: Pick<SalesPdfData, 'number'>): string {
  return `${data.number.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`
}

'use client';

/**
 * The read-only document a client sees at /view/{quote,invoice}/[token].
 *
 * Deliberately standalone: no AppShell, no navigation, nothing that implies the
 * viewer has an account. It renders only what the public API returns, so the
 * staff-only `internalNotes` cannot appear here even by accident.
 */

import React from 'react';
import { FileText, Download, CheckCircle2, XCircle, CreditCard, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export interface PublicLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  total: number;
}

export interface PublicPayment {
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string | null;
}

export interface PublicDocument {
  kind: 'quote' | 'invoice';
  number: string;
  status: string;
  workspaceName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCompany?: string | null;
  clientAddress?: string | null;
  issueDate: string;
  /** validUntil for a quote, dueDate for an invoice. */
  secondaryDate?: string | null;
  currency: string;
  items: PublicLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  payments?: PublicPayment[];
  notes?: string | null;
  terms?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-container-high text-on-surface-variant',
  sent: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  viewed: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  accepted: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  paid: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  partially_paid: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  rejected: 'bg-red-500/15 text-red-600 dark:text-red-400',
  overdue: 'bg-red-500/15 text-red-600 dark:text-red-400',
  expired: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  cancelled: 'bg-surface-container-high text-on-surface-variant',
};

export default function PublicDocumentView({
  doc,
  pdfUrl,
  children,
}: {
  doc: PublicDocument;
  /** Public PDF endpoint, when one is offered. */
  pdfUrl?: string;
  /** Action area — accept/reject for a quote, pay now for an invoice. */
  children?: React.ReactNode;
}) {
  const { t, formatDate, formatCurrency } = useI18n();
  const money = (amount: number, currency: string) => formatCurrency(amount ?? 0, currency);
  const day = (date: string | null | undefined) => {
    if (!date) return '—';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '—';
    return formatDate(parsed, { month: 'long', day: 'numeric', year: 'numeric' });
  };
  const isInvoice = doc.kind === 'invoice';
  const label = isInvoice ? t('public.document.invoiceLabel') : t('public.document.quoteLabel');
  const showAdjustments = doc.items.some((item) => item.discount > 0 || item.taxRate > 0);

  return (
    <div className="min-h-screen bg-surface-container-low px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        {/* Sender identity, so the client knows who this is from before anything else. */}
        <div className="mb-6 flex items-center gap-2 text-sm text-on-surface-variant">
          <FileText className="h-4 w-4" />
          <span>{doc.workspaceName}</span>
        </div>

        <article className="overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-outline-variant/40">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/40 px-6 py-6 sm:px-8">
            <div>
              <h1 className="text-2xl font-semibold text-on-surface">
                {label} {doc.number}
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                {t('public.document.issuedLabel')} {day(doc.issueDate)}
                {doc.secondaryDate
                  ? ` · ${isInvoice ? t('public.document.dueLabel') : t('public.document.validUntilLabel')} ${day(doc.secondaryDate)}`
                  : ''}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                STATUS_STYLES[doc.status] ?? STATUS_STYLES.draft
              }`}
            >
              {doc.status.replace(/_/g, ' ')}
            </span>
          </header>

          <div className="grid gap-6 border-b border-outline-variant/40 px-6 py-6 sm:grid-cols-2 sm:px-8">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {t('public.document.billedTo')}
              </h2>
              <p className="font-medium text-on-surface">{doc.clientName}</p>
              {doc.clientCompany && <p className="text-sm text-on-surface-variant">{doc.clientCompany}</p>}
              {doc.clientEmail && <p className="text-sm text-on-surface-variant">{doc.clientEmail}</p>}
              {doc.clientPhone && <p className="text-sm text-on-surface-variant">{doc.clientPhone}</p>}
              {doc.clientAddress && (
                <p className="whitespace-pre-line text-sm text-on-surface-variant">{doc.clientAddress}</p>
              )}
            </div>
            <div className="sm:text-right">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {isInvoice ? t('public.document.amountDueHeading') : t('public.document.totalHeading')}
              </h2>
              <p className="text-3xl font-semibold text-on-surface">
                {money(isInvoice ? (doc.amountDue ?? doc.total) : doc.total, doc.currency)}
              </p>
              {isInvoice && (doc.amountPaid ?? 0) > 0 && (
                <p className="mt-1 text-sm text-on-surface-variant">
                  {t('public.document.paidOf', {
                    paid: money(doc.amountPaid ?? 0, doc.currency),
                    total: money(doc.total, doc.currency),
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Line items. On narrow screens the table scrolls rather than reflowing,
              so the amount column stays aligned with its row. */}
          <div className="overflow-x-auto px-6 py-6 sm:px-8">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant/60 text-left">
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {t('public.document.descriptionCol')}
                  </th>
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {t('public.document.qtyCol')}
                  </th>
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {t('public.document.unitPriceCol')}
                  </th>
                  {showAdjustments && (
                    <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      {t('public.document.discTaxCol')}
                    </th>
                  )}
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {t('public.document.amountCol')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item, index) => (
                  <tr key={index} className="border-b border-outline-variant/30">
                    <td className="py-3 pr-4 text-on-surface">{item.description || '—'}</td>
                    <td className="py-3 text-right text-on-surface-variant">{item.quantity}</td>
                    <td className="py-3 text-right text-on-surface-variant">
                      {money(item.unitPrice, doc.currency)}
                    </td>
                    {showAdjustments && (
                      <td className="py-3 text-right text-on-surface-variant">
                        {item.discount > 0 ? `-${item.discount}%` : '—'}
                        {item.taxRate > 0 ? ` / ${item.taxRate}%` : ''}
                      </td>
                    )}
                    <td className="py-3 text-right font-medium text-on-surface">
                      {money(item.total, doc.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <dl className="ml-auto mt-6 w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">{t('public.document.subtotal')}</dt>
                <dd className="text-on-surface">{money(doc.subtotal, doc.currency)}</dd>
              </div>
              {doc.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">{t('public.document.discount')}</dt>
                  <dd className="text-on-surface">-{money(doc.discountAmount, doc.currency)}</dd>
                </div>
              )}
              {doc.taxAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">{t('public.document.tax')}</dt>
                  <dd className="text-on-surface">{money(doc.taxAmount, doc.currency)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-outline-variant/60 pt-2">
                <dt className="font-semibold text-on-surface">{t('public.document.total')}</dt>
                <dd className="font-semibold text-on-surface">{money(doc.total, doc.currency)}</dd>
              </div>
              {isInvoice && (
                <>
                  {(doc.amountPaid ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-on-surface-variant">{t('public.document.amountPaid')}</dt>
                      <dd className="text-emerald-600 dark:text-emerald-400">
                        {money(doc.amountPaid ?? 0, doc.currency)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-outline-variant/60 pt-2">
                    <dt className="font-semibold text-on-surface">
                      {(doc.amountDue ?? 0) > 0 ? t('public.document.amountDue') : t('public.document.paidInFull')}
                    </dt>
                    <dd
                      className={`font-semibold ${
                        (doc.amountDue ?? 0) > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {money(doc.amountDue ?? 0, doc.currency)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {isInvoice && (doc.payments?.length ?? 0) > 0 && (
            <section className="border-t border-outline-variant/40 px-6 py-6 sm:px-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {t('public.document.paymentHistory')}
              </h2>
              <ul className="space-y-2 text-sm">
                {doc.payments?.map((payment, index) => (
                  <li key={index} className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">
                      {day(payment.paymentDate)} · {payment.paymentMethod.replace(/_/g, ' ')}
                      {payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}
                    </span>
                    <span className="shrink-0 font-medium text-on-surface">
                      {money(payment.amount, doc.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(doc.notes || doc.terms) && (
            <section className="space-y-4 border-t border-outline-variant/40 px-6 py-6 sm:px-8">
              {doc.notes && (
                <div>
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {t('public.document.notes')}
                  </h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">
                    {doc.notes}
                  </p>
                </div>
              )}
              {doc.terms && (
                <div>
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {t('public.document.terms')}
                  </h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-on-surface-variant">
                    {doc.terms}
                  </p>
                </div>
              )}
            </section>
          )}

          {(children || pdfUrl) && (
            <footer className="flex flex-wrap items-center gap-3 border-t border-outline-variant/40 bg-surface-container-low px-6 py-5 sm:px-8">
              {children}
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                >
                  <Download className="h-4 w-4" />
                  {t('public.document.downloadPdf')}
                </a>
              )}
            </footer>
          )}
        </article>

        <p className="mt-6 text-center text-xs text-on-surface-variant">
          {t('public.document.sentBy', { name: doc.workspaceName })}
        </p>
      </div>
    </div>
  );
}

/** Shared loading state for the public pages. */
export function PublicDocumentLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low">
      <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
    </div>
  );
}

/** Shared error state. A bad token and a deleted document look the same on purpose. */
export function PublicDocumentError({ message }: { message: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 text-center shadow-sm ring-1 ring-outline-variant/40">
        <XCircle className="mx-auto mb-3 h-8 w-8 text-on-surface-variant" />
        <h1 className="mb-1 text-lg font-semibold text-on-surface">{t('public.document.notAvailableTitle')}</h1>
        <p className="text-sm text-on-surface-variant">{message}</p>
      </div>
    </div>
  );
}

export { CheckCircle2, XCircle, CreditCard };

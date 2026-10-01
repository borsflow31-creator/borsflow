'use client';

/**
 * Public invoice view. Outside the middleware matcher, so no session is required —
 * this is the page the client who received the invoice actually opens.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicDocumentView, {
  PublicDocumentLoading,
  PublicDocumentError,
  type PublicDocument,
} from '@/components/documents/PublicDocumentView';
import { useI18n } from '@/i18n/I18nProvider';

interface ApiInvoice {
  invoiceNumber: string;
  status: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientCompany: string | null;
  clientAddress: string | null;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  notes: string | null;
  terms: string | null;
  items: PublicDocument['items'];
  payments: PublicDocument['payments'];
  workspace: { name: string };
}

export default function PublicInvoicePage() {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/invoices/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('public.invoice.loadErrorDefault'));
        return;
      }
      setInvoice(data.invoice);
    } catch {
      setError(t('public.invoice.loadErrorCatch'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PublicDocumentLoading />;
  if (!invoice) return <PublicDocumentError message={error ?? t('public.invoice.loadErrorFallback')} />;

  const doc: PublicDocument = {
    kind: 'invoice',
    number: invoice.invoiceNumber,
    status: invoice.status,
    workspaceName: invoice.workspace.name,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientPhone: invoice.clientPhone,
    clientCompany: invoice.clientCompany,
    clientAddress: invoice.clientAddress,
    issueDate: invoice.issueDate,
    secondaryDate: invoice.dueDate,
    currency: invoice.currency,
    items: invoice.items,
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    amountDue: invoice.amountDue,
    payments: invoice.payments,
    notes: invoice.notes,
    terms: invoice.terms,
  };

  return (
    <PublicDocumentView doc={doc}>
      <p className="text-sm text-on-surface-variant">
        {invoice.status === 'paid'
          ? t('public.invoice.paidMessage')
          : invoice.status === 'cancelled'
            ? t('public.invoice.cancelledMessage')
            : t('public.invoice.defaultMessage')}
      </p>
    </PublicDocumentView>
  );
}

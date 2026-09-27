'use client';

/**
 * Public invoice view. Outside the middleware matcher, so no session is required —
 * this is the page the client who received the invoice actually opens, and where
 * they pay it via the Stripe link already stored on the record.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import PublicDocumentView, {
  PublicDocumentLoading,
  PublicDocumentError,
  type PublicDocument,
} from '@/components/documents/PublicDocumentView';

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
  stripePaymentLink: string | null;
  items: PublicDocument['items'];
  payments: PublicDocument['payments'];
  workspace: { name: string };
}

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [canPay, setCanPay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/invoices/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'This link is no longer valid');
        return;
      }
      setInvoice(data.invoice);
      setCanPay(data.canPay);
    } catch {
      setError('We could not load this invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PublicDocumentLoading />;
  if (!invoice) return <PublicDocumentError message={error ?? 'This link is no longer valid.'} />;

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
      {canPay && invoice.stripePaymentLink ? (
        <a
          href={invoice.stripePaymentLink}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          <CreditCard className="h-4 w-4" />
          Pay {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(invoice.amountDue)}
        </a>
      ) : (
        <p className="text-sm text-on-surface-variant">
          {invoice.status === 'paid'
            ? 'This invoice has been paid in full. Thank you.'
            : invoice.status === 'cancelled'
              ? 'This invoice has been cancelled.'
              : 'Please refer to the payment terms below to settle this invoice.'}
        </p>
      )}
    </PublicDocumentView>
  );
}

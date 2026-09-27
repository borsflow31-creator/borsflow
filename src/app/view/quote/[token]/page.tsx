'use client';

/**
 * Public quote view. Outside the middleware matcher, so no session is required —
 * this is the page the client who received the quote actually opens, and the only
 * surface on which they can accept or reject it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import PublicDocumentView, {
  PublicDocumentLoading,
  PublicDocumentError,
  type PublicDocument,
} from '@/components/documents/PublicDocumentView';

interface ApiQuote {
  quoteNumber: string;
  status: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientCompany: string | null;
  clientAddress: string | null;
  issueDate: string;
  validUntil: string | null;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  items: PublicDocument['items'];
  workspace: { name: string };
}

export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<ApiQuote | null>(null);
  const [canRespond, setCanRespond] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<'accept' | 'reject' | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/quotes/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'This link is no longer valid');
        return;
      }
      setQuote(data.quote);
      setCanRespond(data.canRespond);
    } catch {
      setError('We could not load this quote. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (decision: 'accept' | 'reject') => {
    setResponding(decision);
    setError(null);
    try {
      const res = await fetch(`/api/public/quotes/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'We could not record your response.');
        return;
      }
      setOutcome(data.status);
      setCanRespond(false);
      // Pull the document again so the status badge matches the decision.
      await load();
    } catch {
      setError('We could not record your response. Please try again.');
    } finally {
      setResponding(null);
    }
  };

  if (loading) return <PublicDocumentLoading />;
  if (!quote) return <PublicDocumentError message={error ?? 'This link is no longer valid.'} />;

  const doc: PublicDocument = {
    kind: 'quote',
    number: quote.quoteNumber,
    status: quote.status,
    workspaceName: quote.workspace.name,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    clientPhone: quote.clientPhone,
    clientCompany: quote.clientCompany,
    clientAddress: quote.clientAddress,
    issueDate: quote.issueDate,
    secondaryDate: quote.validUntil,
    currency: quote.currency,
    items: quote.items,
    subtotal: quote.subtotal,
    discountAmount: quote.discountAmount,
    taxAmount: quote.taxAmount,
    total: quote.total,
    notes: quote.notes,
    terms: quote.terms,
  };

  return (
    <>
      <PublicDocumentView doc={doc}>
        {canRespond ? (
          <>
            <button
              onClick={() => respond('accept')}
              disabled={responding !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {responding === 'accept' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Accept quote
            </button>
            <button
              onClick={() => respond('reject')}
              disabled={responding !== null}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50"
            >
              {responding === 'reject' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Decline
            </button>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">
            {outcome === 'accepted'
              ? 'Thank you — this quote has been accepted.'
              : outcome === 'rejected'
                ? 'This quote has been declined.'
                : `This quote is ${quote.status.replace(/_/g, ' ')} and can no longer be changed.`}
          </p>
        )}
      </PublicDocumentView>

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {error}
        </div>
      )}
    </>
  );
}

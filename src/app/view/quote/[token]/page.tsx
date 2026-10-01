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
import { useI18n } from '@/i18n/I18nProvider';

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
  const { t } = useI18n();
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
        setError(data.error || t('public.quote.loadErrorDefault'));
        return;
      }
      setQuote(data.quote);
      setCanRespond(data.canRespond);
    } catch {
      setError(t('public.quote.loadErrorCatch'));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

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
        setError(data.error || t('public.quote.respondErrorDefault'));
        return;
      }
      setOutcome(data.status);
      setCanRespond(false);
      // Pull the document again so the status badge matches the decision.
      await load();
    } catch {
      setError(t('public.quote.respondErrorCatch'));
    } finally {
      setResponding(null);
    }
  };

  if (loading) return <PublicDocumentLoading />;
  if (!quote) return <PublicDocumentError message={error ?? t('public.quote.loadErrorFallback')} />;

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
              {t('public.quote.acceptButton')}
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
              {t('public.quote.declineButton')}
            </button>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">
            {outcome === 'accepted'
              ? t('public.quote.acceptedThankYou')
              : outcome === 'rejected'
                ? t('public.quote.declinedMessage')
                : t('public.quote.statusMessage', { status: quote.status.replace(/_/g, ' ') })}
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

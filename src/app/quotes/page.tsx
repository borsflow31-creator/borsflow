'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useDocumentStore } from '@/store/documentStore';
import { useAppStore } from '@/store/appStore';
import FilterBar from '@/components/documents/FilterBar';
import ViewToggle from '@/components/documents/ViewToggle';
import StatusBadge, { QuoteStatus } from '@/components/documents/StatusBadge';
import {
  Plus, FileText, MoreVertical, Loader2,
  Trash2, Copy, ArrowRight, Mail, FileDown,
  CheckCircle, XCircle, LayoutTemplate, Link,
} from 'lucide-react';
import NoWorkspace from '@/components/NoWorkspace';
import TemplatePickerModal from '@/components/templates/TemplatePickerModal';
import type { Quote } from '@/types';

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

const sortOptions = [
  { value: 'date', label: 'Date' },
  { value: 'client', label: 'Client' },
  { value: 'total', label: 'Total' },
  { value: 'status', label: 'Status' },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all ${
            t.type === 'success' ? 'bg-success' : 'bg-error'
          }`}
        >
          {t.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Send Email Modal ─────────────────────────────────────────────────────────
function SendEmailModal({
  quoteId,
  clientEmail,
  onClose,
  onSent,
}: {
  quoteId: string;
  clientEmail: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(clientEmail);
  const [subject, setSubject] = useState('Your Quote');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      });
      if (!res.ok) throw new Error('Failed to send');
      onSent();
      onClose();
    } catch {
      alert('Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Send Quote by Email</h2>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">To</label>
            <input
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Subject</label>
            <input
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Message (optional)</label>
            <textarea
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm resize-none"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-low text-on-surface rounded-lg hover:bg-surface-container-high transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !to}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Convert Modal ────────────────────────────────────────────────────────────
function ConvertModal({
  quoteId,
  onClose,
  onConverted,
}: {
  quoteId: string;
  onClose: () => void;
  onConverted: (invoiceId: string) => void;
}) {
  const [dueDate, setDueDate] = useState('');
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    setConverting(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: dueDate || undefined }),
      });
      if (!res.ok) throw new Error('Failed to convert');
      const data = await res.json();
      onConverted(data.invoice.id);
      onClose();
    } catch {
      alert('Failed to convert to invoice.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold text-on-surface mb-2">Convert to Invoice</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          A new invoice will be created from this quote.
        </p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Due Date (optional)</label>
          <input
            type="date"
            className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-low text-on-surface rounded-lg hover:bg-surface-container-high transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={converting}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {converting ? 'Converting…' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row Actions Dropdown ─────────────────────────────────────────────────────
function QuoteActions({
  quote,
  onDelete,
  onDuplicate,
  onSend,
  onConvert,
  onPdf,
  onShare,
}: {
  quote: Quote;
  onDelete: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onConvert: () => void;
  onPdf: () => void;
  onShare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
        className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
        aria-label="Quote actions"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-outline-variant/20 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          <button
            onClick={() => { onSend(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <Mail className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            Send by Email
          </button>
          <button
            onClick={() => { onPdf(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <FileDown className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            View PDF
          </button>
          <button
            onClick={() => { onShare(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <Link className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            Copy client link
          </button>
          <button
            onClick={() => { onConvert(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <ArrowRight className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            Convert to Invoice
          </button>
          <button
            onClick={() => { onDuplicate(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <Copy className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            Duplicate
          </button>
          <div className="border-t border-outline-variant/10 my-1" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-error hover:bg-error/5 transition-colors"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function QuotesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = searchParams.get('workspace') || '';
  const { currentWorkspaceId } = useAppStore();

  const {
    quotes,
    setQuotes,
    addQuote,
    deleteQuote,
    quotesViewMode,
    setQuotesViewMode,
    quotesStatusFilter,
    setQuotesStatusFilter,
    quotesSearchQuery,
    setQuotesSearchQuery,
    quotesSortBy,
    setQuotesSortBy,
  } = useDocumentStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sendModal, setSendModal] = useState<Quote | null>(null);
  const [convertModal, setConvertModal] = useState<Quote | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const toastId = useRef(0);

  const effectiveWorkspaceId = workspaceId || currentWorkspaceId || '';

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  useEffect(() => {
    if (effectiveWorkspaceId) fetchQuotes();
  }, [effectiveWorkspaceId, page, quotesStatusFilter, quotesSearchQuery, quotesSortBy]);

  const fetchQuotes = async () => {
    if (!effectiveWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        workspaceId: effectiveWorkspaceId,
        page: page.toString(),
        limit: '20',
      });
      if (quotesStatusFilter !== 'all') params.append('status', quotesStatusFilter);
      if (quotesSearchQuery) params.append('search', quotesSearchQuery);
      if (quotesSortBy) params.append('sortBy', quotesSortBy);

      const res = await fetch(`/api/quotes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      const data = await res.json();
      setQuotes(data.quotes || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quote: Quote) => {
    if (!confirm(`Delete ${quote.quoteNumber}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/quotes/${quote.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      deleteQuote(quote.id);
      addToast(`${quote.quoteNumber} deleted`);
    } catch {
      addToast('Failed to delete quote', 'error');
    }
  };

  const handleDuplicate = async (quote: Quote) => {
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: quote.workspaceId,
          clientName: quote.clientName,
          clientEmail: quote.clientEmail,
          clientCompany: quote.clientCompany,
          clientPhone: quote.clientPhone,
          clientAddress: quote.clientAddress,
          currency: quote.currency,
          taxRate: quote.taxRate,
          notes: quote.notes,
          terms: quote.terms,
          items: (quote as any).items || [],
        }),
      });
      if (!res.ok) throw new Error('Failed to duplicate');
      const data = await res.json();
      addQuote(data.quote);
      addToast(`Duplicated as ${data.quote.quoteNumber}`);
      router.push(`/quotes/${data.quote.id}`);
    } catch {
      addToast('Failed to duplicate quote', 'error');
    }
  };

  const handlePdf = (quoteId: string) => {
    window.open(`/api/quotes/${quoteId}/pdf`, '_blank');
  };

  // Mints the public link if the quote has never been shared, then returns the
  // existing one, so copying twice hands out the same URL.
  const handleShare = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/share`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create link');
      await navigator.clipboard.writeText(data.url);
      addToast('Client link copied to clipboard');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create link', 'error');
    }
  };

  const hasActiveFilters = quotesStatusFilter !== 'all' || quotesSearchQuery !== '';

  const actionProps = (quote: Quote) => ({
    quote,
    onDelete: () => handleDelete(quote),
    onDuplicate: () => handleDuplicate(quote),
    onSend: () => setSendModal(quote),
    onConvert: () => setConvertModal(quote),
    onPdf: () => handlePdf(quote.id),
    onShare: () => handleShare(quote.id),
  });

  if (!effectiveWorkspaceId) return <NoWorkspace />;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface mb-2">Quotes</h1>
          <p className="text-on-surface-variant">Manage your quotes and track their status</p>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <FilterBar
            searchQuery={quotesSearchQuery}
            onSearchChange={setQuotesSearchQuery}
            statusFilter={quotesStatusFilter}
            onStatusChange={setQuotesStatusFilter}
            statusOptions={statusOptions}
            sortBy={quotesSortBy}
            onSortChange={setQuotesSortBy}
            sortOptions={sortOptions}
            onClearFilters={() => { setQuotesStatusFilter('all'); setQuotesSearchQuery(''); }}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        {/* View Toggle + Create */}
        <div className="flex items-center justify-between mb-6">
          <ViewToggle viewMode={quotesViewMode} onViewModeChange={setQuotesViewMode} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-2 px-3 py-2.5 bg-surface border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container transition-colors text-sm font-medium"
            >
              <LayoutTemplate className="h-4 w-4" strokeWidth={1.75} />
              From Template
            </button>
            <button
              onClick={() => router.push('/quotes/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New Quote
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-secondary" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-error-container/10 border border-error/20 rounded-lg p-6 text-center">
            <p className="text-error mb-4">{error}</p>
            <button onClick={fetchQuotes} className="px-4 py-2 bg-error text-on-error rounded-lg hover:opacity-90 text-sm font-medium">
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && quotes.length === 0 && (
          <div className="bg-surface-container-low rounded-lg p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-on-surface-variant" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-on-surface mb-2">No quotes found</h3>
            <p className="text-on-surface-variant mb-6">
              {hasActiveFilters ? 'Try adjusting your filters or search query' : 'Get started by creating your first quote'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => router.push('/quotes/new')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim text-sm font-medium"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Create Quote
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && !error && quotes.length > 0 && quotesViewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                onCardClick={() => router.push(`/quotes/${quote.id}`)}
                {...actionProps(quote)}
              />
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && !error && quotes.length > 0 && quotesViewMode === 'table' && (
          <div className="bg-surface rounded-lg overflow-visible">
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  {['Quote #', 'Client', 'Status', 'Date', 'Total', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider ${i >= 4 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface" onClick={() => router.push(`/quotes/${quote.id}`)}>
                      {quote.quoteNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface" onClick={() => router.push(`/quotes/${quote.id}`)}>
                      {quote.clientName}
                      {quote.clientCompany && (
                        <span className="block text-xs text-on-surface-variant">{quote.clientCompany}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => router.push(`/quotes/${quote.id}`)}>
                      <StatusBadge status={quote.status as QuoteStatus} type="quote" size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant" onClick={() => router.push(`/quotes/${quote.id}`)}>
                      {new Date(quote.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface text-right font-medium" onClick={() => router.push(`/quotes/${quote.id}`)}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <QuoteActions {...actionProps(quote)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && quotes.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-surface-container-low text-on-surface rounded-lg hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  page === n ? 'bg-secondary text-on-secondary' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-surface-container-low text-on-surface rounded-lg hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {sendModal && (
        <SendEmailModal
          quoteId={sendModal.id}
          clientEmail={sendModal.clientEmail || ''}
          onClose={() => setSendModal(null)}
          onSent={() => addToast('Quote sent by email')}
        />
      )}
      {convertModal && (
        <ConvertModal
          quoteId={convertModal.id}
          onClose={() => setConvertModal(null)}
          onConverted={(invoiceId) => {
            addToast('Converted to invoice');
            router.push(`/invoices/${invoiceId}`);
          }}
        />
      )}

      <TemplatePickerModal
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        type="quote"
        workspaceId={effectiveWorkspaceId}
      />
      <ToastContainer toasts={toasts} />
    </AppShell>
  );
}

// ─── Quote Card ───────────────────────────────────────────────────────────────
function QuoteCard({
  quote,
  onCardClick,
  onDelete,
  onDuplicate,
  onSend,
  onConvert,
  onPdf,
  onShare,
}: {
  quote: Quote;
  onCardClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onConvert: () => void;
  onPdf: () => void;
  onShare: () => void;
}) {
  return (
    <div
      onClick={onCardClick}
      className="bg-surface rounded-lg p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group border border-transparent hover:border-outline-variant/20"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-on-surface mb-1 group-hover:text-secondary transition-colors">
            {quote.quoteNumber}
          </h3>
          <p className="text-sm text-on-surface-variant">
            {new Date(quote.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge status={quote.status as QuoteStatus} type="quote" size="sm" />
          <div onClick={(e) => e.stopPropagation()}>
            <QuoteActions
              quote={quote}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onSend={onSend}
              onConvert={onConvert}
              onPdf={onPdf}
              onShare={onShare}
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-base font-medium text-on-surface mb-1">{quote.clientName}</p>
        {quote.clientCompany && (
          <p className="text-sm text-on-surface-variant">{quote.clientCompany}</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
        <span className="text-sm text-on-surface-variant">Total</span>
        <span className="text-xl font-bold text-on-surface">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.total)}
        </span>
      </div>
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense>
      <QuotesPageInner />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useDocumentStore } from '@/store/documentStore';
import { useAppStore } from '@/store/appStore';
import FilterBar from '@/components/documents/FilterBar';
import ViewToggle from '@/components/documents/ViewToggle';
import StatusBadge, { InvoiceStatus } from '@/components/documents/StatusBadge';
import {
  Plus, FileText, MoreVertical, Loader2, AlertCircle,
  Trash2, Copy, Mail, FileDown, CreditCard,
  CheckCircle, XCircle, Link, ExternalLink, X, LayoutTemplate,
} from 'lucide-react';
import NoWorkspace from '@/components/NoWorkspace';
import TemplatePickerModal from '@/components/templates/TemplatePickerModal';
import type { Invoice } from '@/types';
// Loader2 is used in SendInvoiceModal

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

const sortOptions = [
  { value: 'date', label: 'Date' },
  { value: 'client', label: 'Client' },
  { value: 'total', label: 'Total' },
  { value: 'status', label: 'Status' },
  { value: 'dueDate', label: 'Due Date' },
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

// ─── Quick Payment Modal ──────────────────────────────────────────────────────
function QuickPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: Invoice;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [amount, setAmount] = useState(String(invoice.amountDue ?? invoice.total));
  const [method, setMethod] = useState('bank_transfer');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Field names must match the payments endpoint: paymentMethod / paymentDate.
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentMethod: method,
          paymentDate: date,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Failed to record payment');
      }
      onRecorded();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold text-on-surface mb-4">Record Payment</h2>
        <p className="text-sm text-on-surface-variant mb-4">{invoice.invoiceNumber}</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Amount</label>
            <input
              type="number"
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Method</label>
            <select
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-low text-on-surface rounded-lg hover:bg-surface-container-high text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !amount}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Invoice Modal (two-mode) ───────────────────────────────────────────
function SendInvoiceModal({
  invoice,
  stripeConnected,
  onClose,
  onSent,
}: {
  invoice: Invoice;
  stripeConnected: boolean;
  onClose: () => void;
  onSent: (updatedInvoice?: Partial<Invoice>) => void;
}) {
  const [mode, setMode] = useState<'invoice' | 'paylink'>('invoice');
  const [to, setTo] = useState(invoice.clientEmail || '');
  const [subject, setSubject] = useState(`Invoice ${invoice.invoiceNumber}`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      let paymentLink: string | undefined;

      // If pay-link mode, generate the link first. The send endpoint reads the link
      // off the invoice itself rather than taking it from us, so this only has to
      // run before the send — the URL is not passed along.
      if (mode === 'paylink') {
        const plRes = await fetch(`/api/invoices/${invoice.id}/payment-link`, { method: 'POST' });
        const plData = await plRes.json();
        if (!plRes.ok) {
          setError(plData.error || 'Failed to generate payment link');
          setSending(false);
          return;
        }
        paymentLink = plData.paymentLink;
      }

      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message, includePaymentLink: mode === 'paylink' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send invoice');
        return;
      }

      onSent({ ...data.invoice, stripePaymentLink: paymentLink });
      onClose();
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Send Invoice</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">{invoice.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Invoice only */}
          <button
            onClick={() => setMode('invoice')}
            className={`relative text-left p-4 rounded-xl border-2 transition-all ${
              mode === 'invoice'
                ? 'border-secondary bg-secondary/5'
                : 'border-outline-variant/20 hover:border-outline-variant/40'
            }`}
          >
            <Mail className="h-5 w-5 text-secondary mb-2" strokeWidth={1.75} />
            <p className="text-sm font-semibold text-on-surface">Invoice Only</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Send invoice details by email</p>
            {mode === 'invoice' && (
              <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-secondary" />
            )}
          </button>

          {/* Invoice + Pay Link */}
          <button
            onClick={() => stripeConnected && setMode('paylink')}
            disabled={!stripeConnected}
            title={!stripeConnected ? 'Configure Stripe API keys in Settings → Integrations to enable payment links' : undefined}
            className={`relative text-left p-4 rounded-xl border-2 transition-all ${
              !stripeConnected
                ? 'border-outline-variant/10 opacity-50 cursor-not-allowed'
                : mode === 'paylink'
                ? 'border-violet-500 bg-violet-500/5'
                : 'border-outline-variant/20 hover:border-outline-variant/40'
            }`}
          >
            <CreditCard className="h-5 w-5 text-violet-500 mb-2" strokeWidth={1.75} />
            <p className="text-sm font-semibold text-on-surface">Invoice + Pay Link</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {stripeConnected ? 'Includes a Pay Now button' : 'Requires Stripe setup'}
            </p>
            {mode === 'paylink' && (
              <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-violet-500" />
            )}
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">To</label>
            <input
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Subject</label>
            <input
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Message (optional)</label>
            <textarea
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-secondary/50"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note..."
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-surface-container-low text-on-surface rounded-lg hover:bg-surface-container-high text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !to}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
              mode === 'paylink'
                ? 'bg-violet-600 hover:bg-violet-700 text-white'
                : 'bg-secondary text-on-secondary hover:bg-secondary-dim'
            }`}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sending ? 'Sending…' : mode === 'paylink' ? 'Send with Pay Link' : 'Send Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row Actions Dropdown ─────────────────────────────────────────────────────
function InvoiceActions({
  invoice,
  onDelete,
  onDuplicate,
  onSend,
  onPayment,
  onPdf,
  onPaymentLink,
  onShare,
}: {
  invoice: Invoice;
  onDelete: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onPayment: () => void;
  onPdf: () => void;
  onPaymentLink: () => void;
  onShare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isPaid = invoice.status === 'paid' || invoice.status === 'cancelled';
  const hasPaymentLink = !!(invoice as any).stripePaymentLink;

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
        aria-label="Invoice actions"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-surface border border-outline-variant/20 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          <button
            onClick={() => { onShare(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <ExternalLink className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            Copy client link
          </button>
          {!isPaid && (
            <button
              onClick={() => { onPaymentLink(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <Link className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
              {hasPaymentLink ? 'Regenerate Payment Link' : 'Generate Payment Link'}
            </button>
          )}
          {hasPaymentLink && !isPaid && (
            <button
              onClick={() => {
                navigator.clipboard.writeText((invoice as any).stripePaymentLink);
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <Copy className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
              Copy Payment Link
            </button>
          )}
          {!isPaid && (
            <button
              onClick={() => { onPayment(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <CreditCard className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
              Record Payment
            </button>
          )}
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
function InvoicesPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = searchParams.get('workspace') || '';
  const { currentWorkspaceId } = useAppStore();

  const {
    invoices,
    setInvoices,
    addInvoice,
    deleteInvoice,
    invoicesViewMode,
    setInvoicesViewMode,
    invoicesStatusFilter,
    setInvoicesStatusFilter,
    invoicesSearchQuery,
    setInvoicesSearchQuery,
    invoicesSortBy,
    setInvoicesSortBy,
  } = useDocumentStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sendModal, setSendModal] = useState<Invoice | null>(null);
  const [paymentModal, setPaymentModal] = useState<Invoice | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const toastId = useRef(0);

  // Stripe Connect banner state
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null);
  const [stripeBannerDismissed, setStripeBannerDismissed] = useState(false);

  const effectiveWorkspaceId = workspaceId || currentWorkspaceId || '';

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  useEffect(() => {
    if (effectiveWorkspaceId) fetchInvoices();
  }, [effectiveWorkspaceId, page, invoicesStatusFilter, invoicesSearchQuery, invoicesSortBy]);

  useEffect(() => {
    if (!effectiveWorkspaceId) return;
    // Fetch both Stripe Connect status and direct API key settings in parallel
    Promise.all([
      fetch(`/api/stripe/connect/status?workspaceId=${effectiveWorkspaceId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/stripe/settings?workspaceId=${effectiveWorkspaceId}`).then(r => r.ok ? r.json() : null),
    ]).then(([connectData, settingsData]) => {
      const connectOk = connectData?.chargesEnabled === true;
      const directOk = settingsData?.directKeysEnabled === true;
      setStripeConnected(connectOk || directOk);
    }).catch(() => {});
  }, [effectiveWorkspaceId]);

  const fetchInvoices = async () => {
    if (!effectiveWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        workspaceId: effectiveWorkspaceId,
        page: page.toString(),
        limit: '20',
      });
      if (invoicesStatusFilter !== 'all') params.append('status', invoicesStatusFilter);
      if (invoicesSearchQuery) params.append('search', invoicesSearchQuery);
      if (invoicesSortBy) params.append('sortBy', invoicesSortBy);

      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(data.invoices || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Delete ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      deleteInvoice(invoice.id);
      addToast(`${invoice.invoiceNumber} deleted`);
    } catch {
      addToast('Failed to delete invoice', 'error');
    }
  };

  const handleDuplicate = async (invoice: Invoice) => {
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: invoice.workspaceId,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          clientCompany: invoice.clientCompany,
          clientPhone: invoice.clientPhone,
          clientAddress: invoice.clientAddress,
          currency: invoice.currency,
          taxRate: invoice.taxRate,
          notes: invoice.notes,
          terms: invoice.terms,
          items: (invoice as any).items || [],
        }),
      });
      if (!res.ok) throw new Error('Failed to duplicate');
      const data = await res.json();
      addInvoice(data.invoice);
      addToast(`Duplicated as ${data.invoice.invoiceNumber}`);
      router.push(`/invoices/${data.invoice.id}`);
    } catch {
      addToast('Failed to duplicate invoice', 'error');
    }
  };

  const handlePdf = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
  };

  const handlePaymentLink = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payment-link`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'Failed to generate payment link', 'error');
        return;
      }
      // Update the invoice in the list with the new payment link
      setInvoices(invoices.map((inv) =>
        inv.id === invoice.id ? { ...inv, ...(data.invoice ?? {}), stripePaymentLink: data.paymentLink } : inv
      ));
      await navigator.clipboard.writeText(data.paymentLink);
      addToast('Payment link generated and copied to clipboard');
    } catch {
      addToast('Failed to generate payment link', 'error');
    }
  };

  const isOverdue = (dueDate: Date | string | null, status: string) => {
    if (!dueDate || status === 'paid' || status === 'cancelled') return false;
    return new Date(dueDate) < new Date();
  };

  const hasActiveFilters = invoicesStatusFilter !== 'all' || invoicesSearchQuery !== '';

  // Mints the public link if the invoice has never been shared, then returns the
  // existing one, so copying twice hands out the same URL.
  const handleShare = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create link');
      await navigator.clipboard.writeText(data.url);
      addToast('Client link copied to clipboard');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create link', 'error');
    }
  };

  const actionProps = (invoice: Invoice) => ({
    invoice,
    onDelete: () => handleDelete(invoice),
    onDuplicate: () => handleDuplicate(invoice),
    onSend: () => setSendModal(invoice),
    onPayment: () => setPaymentModal(invoice),
    onPdf: () => handlePdf(invoice.id),
    onPaymentLink: () => handlePaymentLink(invoice),
    onShare: () => handleShare(invoice.id),
  });

  if (!effectiveWorkspaceId) return <NoWorkspace />;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface mb-2">Invoices</h1>
          <p className="text-on-surface-variant">Manage your invoices and track payments</p>
        </div>

        {/* Stripe Status Banners */}
        {stripeConnected === true && !stripeBannerDismissed && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-success/10 border border-success/30 rounded-lg text-sm">
            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
            <span className="flex-1 text-on-surface">
              Stripe is connected — payment links are enabled on your invoices.
            </span>
            <button
              onClick={() => setStripeBannerDismissed(true)}
              className="p-1 text-on-surface-variant hover:text-on-surface rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {stripeConnected === false && !stripeBannerDismissed && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
            <span className="flex-1 text-on-surface">
              Connect Stripe to accept online payments and generate payment links on invoices.
            </span>
            <button
              onClick={() => router.push('/settings?section=integrations')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-on-secondary rounded-lg text-xs font-medium hover:bg-secondary-dim transition-colors whitespace-nowrap"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Set Up Stripe
            </button>
            <button
              onClick={() => setStripeBannerDismissed(true)}
              className="p-1 text-on-surface-variant hover:text-on-surface rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6">
          <FilterBar
            searchQuery={invoicesSearchQuery}
            onSearchChange={setInvoicesSearchQuery}
            statusFilter={invoicesStatusFilter}
            onStatusChange={setInvoicesStatusFilter}
            statusOptions={statusOptions}
            sortBy={invoicesSortBy}
            onSortChange={setInvoicesSortBy}
            sortOptions={sortOptions}
            onClearFilters={() => { setInvoicesStatusFilter('all'); setInvoicesSearchQuery(''); }}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        {/* View Toggle + Create */}
        <div className="flex items-center justify-between mb-6">
          <ViewToggle viewMode={invoicesViewMode} onViewModeChange={setInvoicesViewMode} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplatePicker(true)}
              className="flex items-center gap-2 px-3 py-2.5 bg-surface border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container transition-colors text-sm font-medium"
            >
              <LayoutTemplate className="h-4 w-4" strokeWidth={1.75} />
              From Template
            </button>
            <button
              onClick={() => router.push('/invoices/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New Invoice
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
            <button onClick={fetchInvoices} className="px-4 py-2 bg-error text-on-error rounded-lg hover:opacity-90 text-sm font-medium">
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && invoices.length === 0 && (
          <div className="bg-surface-container-low rounded-lg p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-on-surface-variant" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-on-surface mb-2">No invoices found</h3>
            <p className="text-on-surface-variant mb-6">
              {hasActiveFilters ? 'Try adjusting your filters or search query' : 'Get started by creating your first invoice'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => router.push('/invoices/new')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim text-sm font-medium"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Create Invoice
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && !error && invoices.length > 0 && invoicesViewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                onCardClick={() => router.push(`/invoices/${invoice.id}`)}
                isOverdue={isOverdue(invoice.dueDate, invoice.status)}
                {...actionProps(invoice)}
              />
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && !error && invoices.length > 0 && invoicesViewMode === 'table' && (
          <div className="bg-surface rounded-lg overflow-visible">
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  {['Invoice #', 'Client', 'Status', 'Due Date', 'Total', 'Paid', 'Actions'].map((h, i) => (
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
                {invoices.map((invoice) => {
                  const overdue = isOverdue(invoice.dueDate, invoice.status);
                  return (
                    <tr
                      key={invoice.id}
                      className="hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                        {invoice.clientName}
                        {invoice.clientCompany && (
                          <span className="block text-xs text-on-surface-variant">{invoice.clientCompany}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={invoice.status as InvoiceStatus} type="invoice" size="sm" />
                          {overdue && <AlertCircle className="h-4 w-4 text-error" strokeWidth={1.75} />}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                        {overdue && <span className="ml-2 text-xs text-error font-medium">(Overdue)</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface text-right font-medium" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(invoice.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface text-right" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(invoice.amountPaid)}
                        {invoice.amountDue > 0 && (
                          <span className="block text-xs text-warning">
                            Due: {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(invoice.amountDue)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <InvoiceActions {...actionProps(invoice)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && invoices.length > 0 && totalPages > 1 && (
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
        <SendInvoiceModal
          invoice={sendModal}
          stripeConnected={stripeConnected === true}
          onClose={() => setSendModal(null)}
          onSent={(updated) => {
            if (updated) {
              setInvoices(invoices.map(inv =>
                inv.id === sendModal.id ? { ...inv, ...updated } : inv
              ));
            }
            addToast('Invoice sent by email');
          }}
        />
      )}
      {paymentModal && (
        <QuickPaymentModal
          invoice={paymentModal}
          onClose={() => setPaymentModal(null)}
          onRecorded={() => {
            addToast('Payment recorded');
            fetchInvoices();
          }}
        />
      )}

      <TemplatePickerModal
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        type="invoice"
        workspaceId={effectiveWorkspaceId}
      />
      <ToastContainer toasts={toasts} />
    </AppShell>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────
function InvoiceCard({
  invoice,
  onCardClick,
  isOverdue,
  onDelete,
  onDuplicate,
  onSend,
  onPayment,
  onPdf,
  onPaymentLink,
  onShare,
}: {
  invoice: Invoice;
  onCardClick: () => void;
  isOverdue: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onPayment: () => void;
  onPdf: () => void;
  onPaymentLink: () => void;
  onShare: () => void;
}) {
  const paymentPercentage = invoice.total > 0 ? Math.min(100, (invoice.amountPaid / invoice.total) * 100) : 0;
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(n);

  return (
    <div
      onClick={onCardClick}
      className="bg-surface rounded-lg p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group border border-transparent hover:border-outline-variant/20"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-on-surface mb-1 group-hover:text-secondary transition-colors">
            {invoice.invoiceNumber}
          </h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-on-surface-variant">
              {new Date(invoice.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            {isOverdue && <AlertCircle className="h-4 w-4 text-error" strokeWidth={1.75} />}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge status={invoice.status as InvoiceStatus} type="invoice" size="sm" />
          <div onClick={(e) => e.stopPropagation()}>
            <InvoiceActions
              invoice={invoice}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onSend={onSend}
              onPayment={onPayment}
              onPdf={onPdf}
              onPaymentLink={onPaymentLink}
              onShare={onShare}
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-base font-medium text-on-surface mb-1">{invoice.clientName}</p>
        {invoice.clientCompany && (
          <p className="text-sm text-on-surface-variant">{invoice.clientCompany}</p>
        )}
      </div>

      {invoice.dueDate && (
        <p className="text-sm text-on-surface-variant mb-4">
          Due: {new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {isOverdue && <span className="ml-2 text-error font-medium">(Overdue)</span>}
        </p>
      )}

      {invoice.amountPaid > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-success transition-all duration-300" style={{ width: `${paymentPercentage}%` }} />
          </div>
          <div className="mt-1 text-xs text-on-surface-variant text-right">{Math.round(paymentPercentage)}% paid</div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
        <span className="text-sm text-on-surface-variant">Total</span>
        <span className="text-xl font-bold text-on-surface">{fmt(invoice.total)}</span>
      </div>

      {invoice.amountDue > 0 && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-warning">Amount Due</span>
          <span className="text-base font-semibold text-warning">{fmt(invoice.amountDue)}</span>
        </div>
      )}

      {(invoice as any).stripePaymentLink && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
        <div className="mt-3 pt-3 border-t border-outline-variant/10" onClick={(e) => e.stopPropagation()}>
          <a
            href={(invoice as any).stripePaymentLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 transition-colors text-sm font-medium"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            Pay Now
          </a>
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <InvoicesPageInner />
    </Suspense>
  );
}

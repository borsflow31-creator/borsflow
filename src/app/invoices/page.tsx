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
  CheckCircle, XCircle, ExternalLink, X, LayoutTemplate,
} from 'lucide-react';
import NoWorkspace from '@/components/NoWorkspace';
import TemplatePickerModal from '@/components/templates/TemplatePickerModal';
import type { Invoice } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import SenderPicker, { useDocumentSender } from '@/components/documents/SenderPicker';
// Loader2 is used in SendInvoiceModal

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
  const { t } = useI18n();
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
        throw new Error(body?.error || t('invoices.quickPaymentModal.genericFailure'));
      }
      onRecorded();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('invoices.quickPaymentModal.genericFailure'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold text-on-surface mb-4">{t('invoices.quickPaymentModal.title')}</h2>
        <p className="text-sm text-on-surface-variant mb-4">{invoice.invoiceNumber}</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('invoices.quickPaymentModal.amount')}</label>
            <input
              type="number"
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('invoices.quickPaymentModal.method')}</label>
            <select
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="bank_transfer">{t('invoices.paymentMethod.bankTransfer')}</option>
              <option value="cash">{t('invoices.paymentMethod.cash')}</option>
              <option value="check">{t('invoices.paymentMethod.check')}</option>
              <option value="credit_card">{t('invoices.paymentMethod.creditCard')}</option>
              <option value="paypal">{t('invoices.paymentMethod.paypal')}</option>
              <option value="other">{t('invoices.paymentMethod.other')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('invoices.quickPaymentModal.date')}</label>
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
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !amount}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-50 text-sm font-medium"
          >
            {saving ? t('invoices.quickPaymentModal.recording') : t('invoices.quickPaymentModal.record')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Invoice Modal ───────────────────────────────────────────────────────
function SendInvoiceModal({
  invoice,
  onClose,
  onSent,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSent: (updatedInvoice?: Partial<Invoice>) => void;
}) {
  const { t } = useI18n();
  const [to, setTo] = useState(invoice.clientEmail || '');
  const [subject, setSubject] = useState(t('invoices.sendModal.subjectTemplate', { number: invoice.invoiceNumber }));
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const sender = useDocumentSender(invoice.workspaceId);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message, sendFrom: sender.sendFrom }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('invoices.sendModal.failedToSend'));
        return;
      }

      onSent(data.invoice);
      onClose();
    } catch {
      setError(t('invoices.sendModal.genericError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-on-surface">{t('invoices.sendModal.title')}</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">{invoice.invoiceNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3 mb-5">
          <SenderPicker connected={sender.connected} senderName={sender.senderName} value={sender.sendFrom} onChange={sender.setSendFrom} />
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('invoices.sendModal.to')}</label>
            <input
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={t('invoices.sendModal.toPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('invoices.sendModal.subject')}</label>
            <input
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">{t('invoices.sendModal.message')}</label>
            <textarea
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-secondary/50"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('invoices.sendModal.messagePlaceholder')}
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
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !to}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors bg-secondary text-on-secondary hover:bg-secondary-dim"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sending ? t('invoices.sendModal.sending') : t('invoices.sendModal.send')}
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
  onShare,
}: {
  invoice: Invoice;
  onDelete: () => void;
  onDuplicate: () => void;
  onSend: () => void;
  onPayment: () => void;
  onPdf: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isPaid = invoice.status === 'paid' || invoice.status === 'cancelled';

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
        aria-label={t('invoices.actions.menuAria')}
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
            {t('invoices.actions.copyClientLink')}
          </button>
          {!isPaid && (
            <button
              onClick={() => { onPayment(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <CreditCard className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
              {t('invoices.actions.recordPayment')}
            </button>
          )}
          <button
            onClick={() => { onSend(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <Mail className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            {t('invoices.actions.sendByEmail')}
          </button>
          <button
            onClick={() => { onPdf(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <FileDown className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            {t('invoices.actions.viewPdf')}
          </button>
          <button
            onClick={() => { onDuplicate(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <Copy className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
            {t('invoices.actions.duplicate')}
          </button>
          <div className="border-t border-outline-variant/10 my-1" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-error hover:bg-error/5 transition-colors"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            {t('invoices.actions.delete')}
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
  const { t, formatDate, formatCurrency } = useI18n();

  const statusOptions = [
    { value: 'all', label: t('invoices.status.all') },
    { value: 'draft', label: t('invoices.status.draft') },
    { value: 'sent', label: t('invoices.status.sent') },
    { value: 'viewed', label: t('invoices.status.viewed') },
    { value: 'partially_paid', label: t('invoices.status.partiallyPaid') },
    { value: 'paid', label: t('invoices.status.paid') },
    { value: 'overdue', label: t('invoices.status.overdue') },
    { value: 'cancelled', label: t('invoices.status.cancelled') },
  ];

  const sortOptions = [
    { value: 'date', label: t('invoices.sort.date') },
    { value: 'client', label: t('invoices.sort.client') },
    { value: 'total', label: t('invoices.sort.total') },
    { value: 'status', label: t('invoices.sort.status') },
    { value: 'dueDate', label: t('invoices.sort.dueDate') },
  ];

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

  const effectiveWorkspaceId = workspaceId || currentWorkspaceId || '';

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  useEffect(() => {
    if (effectiveWorkspaceId) fetchInvoices();
  }, [effectiveWorkspaceId, page, invoicesStatusFilter, invoicesSearchQuery, invoicesSortBy]);

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
      if (!res.ok) throw new Error(t('invoices.list.failedToFetch'));
      const data = await res.json();
      setInvoices(data.invoices || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(t('invoices.list.deleteConfirm', { number: invoice.invoiceNumber }))) return;
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('invoices.list.failedToDelete'));
      deleteInvoice(invoice.id);
      addToast(t('invoices.list.toastDeleted', { number: invoice.invoiceNumber }));
    } catch {
      addToast(t('invoices.list.failedToDelete'), 'error');
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
      if (!res.ok) throw new Error(t('invoices.list.failedToDuplicate'));
      const data = await res.json();
      addInvoice(data.invoice);
      addToast(t('invoices.list.toastDuplicated', { number: data.invoice.invoiceNumber }));
      router.push(`/invoices/${data.invoice.id}`);
    } catch {
      addToast(t('invoices.list.failedToDuplicate'), 'error');
    }
  };

  const handlePdf = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
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
      if (!res.ok) throw new Error(data.error || t('invoices.list.failedToCreateLink'));
      await navigator.clipboard.writeText(data.url);
      addToast(t('invoices.list.toastLinkCopied'));
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('invoices.list.failedToCreateLink'), 'error');
    }
  };

  const actionProps = (invoice: Invoice) => ({
    invoice,
    onDelete: () => handleDelete(invoice),
    onDuplicate: () => handleDuplicate(invoice),
    onSend: () => setSendModal(invoice),
    onPayment: () => setPaymentModal(invoice),
    onPdf: () => handlePdf(invoice.id),
    onShare: () => handleShare(invoice.id),
  });

  if (!effectiveWorkspaceId) return <NoWorkspace />;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface mb-2">{t('invoices.list.title')}</h1>
          <p className="text-on-surface-variant">{t('invoices.list.subtitle')}</p>
        </div>

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
              {t('invoices.list.fromTemplate')}
            </button>
            <button
              onClick={() => router.push('/invoices/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              {t('invoices.list.newInvoice')}
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
              {t('invoices.list.tryAgain')}
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && invoices.length === 0 && (
          <div className="bg-surface-container-low rounded-lg p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-on-surface-variant" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-on-surface mb-2">{t('invoices.list.emptyTitle')}</h3>
            <p className="text-on-surface-variant mb-6">
              {hasActiveFilters ? t('invoices.list.emptyFiltered') : t('invoices.list.emptyGetStarted')}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => router.push('/invoices/new')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim text-sm font-medium"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                {t('invoices.list.createInvoice')}
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
                  {[
                    t('invoices.list.colNumber'),
                    t('invoices.list.colClient'),
                    t('invoices.list.colStatus'),
                    t('invoices.list.colDueDate'),
                    t('invoices.list.colTotal'),
                    t('invoices.list.colPaid'),
                    t('invoices.list.colActions'),
                  ].map((h, i) => (
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
                          ? formatDate(invoice.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                        {overdue && <span className="ml-2 text-xs text-error font-medium">{t('invoices.list.overdueTag')}</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface text-right font-medium" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                        {formatCurrency(invoice.total, invoice.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface text-right" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                        {formatCurrency(invoice.amountPaid, invoice.currency)}
                        {invoice.amountDue > 0 && (
                          <span className="block text-xs text-warning">
                            {t('invoices.card.dueAmount', { amount: formatCurrency(invoice.amountDue, invoice.currency) })}
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
              {t('invoices.list.previous')}
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
              {t('invoices.list.next')}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {sendModal && (
        <SendInvoiceModal
          invoice={sendModal}
          onClose={() => setSendModal(null)}
          onSent={(updated) => {
            if (updated) {
              setInvoices(invoices.map(inv =>
                inv.id === sendModal.id ? { ...inv, ...updated } : inv
              ));
            }
            addToast(t('invoices.list.toastInvoiceSent'));
          }}
        />
      )}
      {paymentModal && (
        <QuickPaymentModal
          invoice={paymentModal}
          onClose={() => setPaymentModal(null)}
          onRecorded={() => {
            addToast(t('invoices.list.toastPaymentRecorded'));
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
  onShare: () => void;
}) {
  const { t, formatDate, formatCurrency } = useI18n();
  const paymentPercentage = invoice.total > 0 ? Math.min(100, (invoice.amountPaid / invoice.total) * 100) : 0;

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
              {formatDate(invoice.issueDate, { month: 'short', day: 'numeric', year: 'numeric' })}
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
          {t('invoices.card.dueDateText', { date: formatDate(invoice.dueDate, { month: 'short', day: 'numeric', year: 'numeric' }) })}
          {isOverdue && <span className="ml-2 text-error font-medium">{t('invoices.list.overdueTag')}</span>}
        </p>
      )}

      {invoice.amountPaid > 0 && (
        <div className="mb-4">
          <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-success transition-all duration-300" style={{ width: `${paymentPercentage}%` }} />
          </div>
          <div className="mt-1 text-xs text-on-surface-variant text-right">
            {t('invoices.card.paidPercent', { percent: Math.round(paymentPercentage) })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
        <span className="text-sm text-on-surface-variant">{t('invoices.card.total')}</span>
        <span className="text-xl font-bold text-on-surface">{formatCurrency(invoice.total, invoice.currency)}</span>
      </div>

      {invoice.amountDue > 0 && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-warning">{t('invoices.card.amountDue')}</span>
          <span className="text-base font-semibold text-warning">{formatCurrency(invoice.amountDue, invoice.currency)}</span>
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

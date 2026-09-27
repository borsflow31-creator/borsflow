'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useDocumentStore } from '@/store/documentStore';
import { useAppStore } from '@/store/appStore';
import StatusBadge, { InvoiceStatus } from '@/components/documents/StatusBadge';
import { calculateDocumentTotals } from '@/lib/documents/calculations';
import LineItemsTable, { LineItem } from '@/components/documents/LineItemsTable';
import CalculationsSummary, { DiscountType } from '@/components/documents/CalculationsSummary';
import {
  ArrowLeft, Save, Mail, Download, MoreVertical, Loader2, X,
  Trash2, Copy, DollarSign, Plus, Check, AlertCircle, Send, FileText, Link,
} from 'lucide-react';
import type { Invoice, Payment } from '@/types';

// ─── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({
  invoice,
  onClose,
  onPaymentRecorded,
}: {
  invoice: Invoice;
  onClose: () => void;
  onPaymentRecorded: (updatedInvoice: Invoice) => void;
}) {
  const [amount, setAmount] = useState(invoice.amountDue > 0 ? String(invoice.amountDue.toFixed(2)) : '');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(n);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsedAmount, paymentDate, paymentMethod, referenceNumber: referenceNumber || null, notes: notes || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to record payment');
      }
      const data = await res.json();
      onPaymentRecorded(data.invoice);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <h2 className="text-lg font-semibold text-on-surface">Record Payment</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors">
            <X className="h-5 w-5 text-on-surface-variant" strokeWidth={1.75} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-error bg-error-container/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
            <span className="text-sm text-on-surface-variant">Amount Due</span>
            <span className="font-semibold text-on-surface">{formatCurrency(invoice.amountDue)}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">
              Amount <span className="text-error">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">{invoice.currency}</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0.01" step="0.01"
                className="w-full pl-12 pr-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Payment Date</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Reference Number</label>
            <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Transaction ID, check number..."
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-outline-variant/10">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 transition-colors text-sm font-medium">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <DollarSign className="h-4 w-4" strokeWidth={1.75} />}
            <span>{saving ? 'Recording...' : 'Record Payment'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Email Modal ─────────────────────────────────────────────────────────
function SendEmailModal({ invoice, onClose, onSent }: { invoice: Invoice; onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState(invoice.clientEmail || '');
  const [subject, setSubject] = useState(`Invoice ${invoice.invoiceNumber}`);
  const [message, setMessage] = useState(`Dear ${invoice.clientName},\n\nPlease find your invoice below. Payment is due on ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}.\n\nThank you for your business.`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!to) { setError('Recipient email is required'); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to send');
      }
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <h2 className="text-lg font-semibold text-on-surface">Send Invoice</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors">
            <X className="h-5 w-5 text-on-surface-variant" strokeWidth={1.75} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-error bg-error-container/10 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">To</label>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-outline-variant/10">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending}
            className="flex items-center gap-2 px-5 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 transition-colors text-sm font-medium">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Send className="h-4 w-4" strokeWidth={1.75} />}
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const isNew = invoiceId === 'new';

  const { currentInvoice, setCurrentInvoice, updateInvoice, deleteInvoice, addInvoice } = useDocumentStore();
  const { currentWorkspaceId } = useAppStore();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNew);
  const [hasChanges, setHasChanges] = useState(isNew);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([{
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    taxRate: 0,
    total: 0,
  }]);
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchInvoice = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) throw new Error('Failed to fetch invoice');
      const data = await response.json();
      const invoice = data.invoice;
      setCurrentInvoice(invoice);
      setStatus(invoice.status);
      setIssueDate(new Date(invoice.issueDate).toISOString().split('T')[0]);
      setDueDate(invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '');
      setCurrency(invoice.currency);
      setClientName(invoice.clientName);
      setClientEmail(invoice.clientEmail || '');
      setClientPhone(invoice.clientPhone || '');
      setClientCompany(invoice.clientCompany || '');
      setClientAddress(invoice.clientAddress || '');
      setNotes(invoice.notes || '');
      setTerms(invoice.terms || '');
      setInternalNotes(invoice.internalNotes || '');
      setItems(invoice.items.map((item: any) => ({
        id: item.id, description: item.description, quantity: item.quantity,
        unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate, total: item.total,
      })));
      setDiscountType((invoice.discountType || 'none') as DiscountType);
      setDiscountValue(invoice.discountValue || 0);
      setTaxRate(invoice.taxRate || 0);
      setPayments(invoice.payments || []);
      setIsEditing(invoice.status === 'draft');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, isNew, setCurrentInvoice]);

  useEffect(() => {
    if (!isNew) fetchInvoice();
  }, [isNew, fetchInvoice]);

  // Totals
  // Shared with the server so the figures shown here are the figures persisted.
  const { subtotal, discountAmount, taxAmount, total } = calculateDocumentTotals(items, {
    taxRate,
    discountType,
    discountValue,
  });
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  // Clamped to match what the server stores; an overpayment shows as a credit via amountPaid.
  const amountDue = Math.max(0, total - amountPaid);
  // A zero-total invoice would make this NaN%.
  const paidPercent = total > 0 ? Math.min(100, (amountPaid / total) * 100) : 0;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        status, issueDate, dueDate: dueDate || null, currency,
        clientName, clientEmail: clientEmail || null, clientPhone: clientPhone || null,
        clientCompany: clientCompany || null, clientAddress: clientAddress || null,
        notes: notes || null, terms: terms || null, internalNotes: internalNotes || null,
        discountType: discountType === 'none' ? null : discountType,
        discountValue: discountType === 'none' ? 0 : discountValue,
        taxRate, subtotal, taxAmount, discountAmount, total, amountPaid, amountDue,
        items: items.map((item) => ({
          id: item.id, description: item.description, quantity: item.quantity,
          unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate, total: item.total,
        })),
      };
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to save invoice');
      const data = await response.json();
      setCurrentInvoice(data.invoice);
      updateInvoice(invoiceId, data.invoice);
      setHasChanges(false);
      showToast('Invoice saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!clientName.trim()) { setError('Client name is required'); return; }
    if (!currentWorkspaceId) { setError('No active workspace selected'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        workspaceId: currentWorkspaceId,
        clientName, clientEmail: clientEmail || null, clientPhone: clientPhone || null,
        clientCompany: clientCompany || null, clientAddress: clientAddress || null,
        issueDate, dueDate: dueDate || null, currency,
        notes: notes || null, terms: terms || null, internalNotes: internalNotes || null,
        discountType: discountType === 'none' ? null : discountType,
        discountValue: discountType === 'none' ? 0 : discountValue,
        taxRate,
        items: items.map((item) => ({
          description: item.description, quantity: item.quantity,
          unitPrice: item.unitPrice, discount: item.discount,
          taxRate: item.taxRate, total: item.total,
        })),
      };
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error || 'Failed to create invoice');
      }
      const data = await response.json();
      addInvoice(data.invoice);
      router.replace(`/invoices/${data.invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!currentInvoice) return;
    try {
      const payload = {
        workspaceId: currentInvoice.workspaceId,
        leadId: currentInvoice.leadId,
        clientName: currentInvoice.clientName,
        clientEmail: currentInvoice.clientEmail,
        clientPhone: currentInvoice.clientPhone,
        clientCompany: currentInvoice.clientCompany,
        clientAddress: currentInvoice.clientAddress,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: null,
        currency: currentInvoice.currency,
        taxRate: currentInvoice.taxRate,
        discountType: currentInvoice.discountType,
        discountValue: currentInvoice.discountValue,
        notes: currentInvoice.notes,
        terms: currentInvoice.terms,
        internalNotes: currentInvoice.internalNotes,
        items: currentInvoice.items.map((item) => ({
          description: item.description, quantity: item.quantity,
          unitPrice: item.unitPrice, discount: item.discount,
          taxRate: item.taxRate, total: item.total,
        })),
      };
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to duplicate');
      const data = await response.json();
      router.push(`/invoices/${data.invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate');
    }
  };

  const handleGeneratePaymentLink = async () => {
    setGeneratingLink(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate payment link');
      setCurrentInvoice(data.invoice);
      updateInvoice(invoiceId, data.invoice);
      showToast('Payment link generated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate payment link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${currentInvoice?.invoiceNumber}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete invoice');
      deleteInvoice(invoiceId);
      router.push('/invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Remove this payment? The invoice will be updated.')) return;
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments?paymentId=${paymentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete payment');
      const data = await res.json();
      setCurrentInvoice(data.invoice);
      setPayments(data.invoice.payments || []);
      setStatus(data.invoice.status);
      showToast('Payment removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const formatDate = (date: Date | string | null) =>
    date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const isOverdue = dueDate ? new Date(dueDate) < new Date() && status !== 'paid' && status !== 'cancelled' : false;

  if (loading && !isNew) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      </AppShell>
    );
  }

  if (error && !currentInvoice && !isNew) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-error-container/10 border border-error/20 rounded-lg p-6 text-center">
            <p className="text-error mb-4">{error}</p>
            <button onClick={() => router.back()} className="px-4 py-2 bg-error text-on-error rounded-lg hover:opacity-90 text-sm font-medium">Go Back</button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-surface rounded-lg shadow-xl border border-outline-variant/10 text-sm font-medium text-on-surface">
          <Check className="h-4 w-4 text-success" strokeWidth={2} />
          {toast}
        </div>
      )}

      {showPaymentModal && currentInvoice && (
        <PaymentModal
          invoice={{ ...currentInvoice, amountDue, amountPaid }}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={(updatedInvoice) => {
            setCurrentInvoice(updatedInvoice);
            updateInvoice(invoiceId, updatedInvoice);
            setPayments(updatedInvoice.payments || []);
            setStatus(updatedInvoice.status);
            showToast('Payment recorded successfully');
          }}
        />
      )}

      {showSendModal && currentInvoice && (
        <SendEmailModal
          invoice={currentInvoice}
          onClose={() => setShowSendModal(false)}
          onSent={() => {
            showToast('Invoice sent successfully');
            fetchInvoice();
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors" aria-label="Go back">
              <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-on-surface mb-1">
                {isNew ? 'New Invoice' : (currentInvoice?.invoiceNumber || 'Invoice')}
              </h1>
              {!isNew && (
                <div className="flex items-center gap-3">
                  <StatusBadge status={status} type="invoice" />
                  {isOverdue && (
                    <span className="flex items-center gap-1 text-xs text-error font-medium">
                      <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
                      Overdue
                    </span>
                  )}
                  {currentInvoice?.quoteId && (
                    <button
                      onClick={() => router.push(`/quotes/${currentInvoice.quoteId}`)}
                      className="text-xs text-secondary underline-offset-2 hover:underline"
                    >
                      From quote
                    </button>
                  )}
                  {currentInvoice?.stripePaymentLink && (
                    <a
                      href={currentInvoice.stripePaymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-secondary underline-offset-2 hover:underline"
                    >
                      <Link className="h-3 w-3" strokeWidth={2} />
                      Payment link
                    </a>
                  )}
                  {hasChanges && (
                    <span className="text-xs text-warning flex items-center gap-1">
                      <span className="w-2 h-2 bg-warning rounded-full" />
                      Unsaved changes
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <>
                {status !== 'paid' && status !== 'cancelled' && (
                  <button onClick={() => setShowPaymentModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary hover:bg-secondary-dim rounded-lg transition-colors text-sm font-medium">
                    <DollarSign className="h-4 w-4" strokeWidth={1.75} />
                    <span className="hidden sm:inline">Payment</span>
                  </button>
                )}
                <button onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface hover:bg-surface-container-high rounded-lg transition-colors text-sm font-medium">
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Send</span>
                </button>
                <button onClick={() => window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface hover:bg-surface-container-high rounded-lg transition-colors text-sm font-medium">
                  <Download className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <div className="relative">
                  <button onClick={() => setShowActionsMenu(!showActionsMenu)}
                    className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors" aria-label="More options">
                    <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                  {showActionsMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowActionsMenu(false)} />
                      <div className="absolute right-0 top-full mt-2 z-20 w-56 bg-surface rounded-lg shadow-xl border border-outline-variant/10 py-1 overflow-hidden">
                        <button onClick={() => { setShowActionsMenu(false); setIsEditing(true); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3">
                          <FileText className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
                          Edit Invoice
                        </button>
                        <button onClick={() => { setShowActionsMenu(false); handleDuplicate(); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3">
                          <Copy className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
                          Duplicate Invoice
                        </button>
                        {status !== 'paid' && status !== 'cancelled' && (
                          <button onClick={() => { setShowActionsMenu(false); handleGeneratePaymentLink(); }}
                            disabled={generatingLink}
                            className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3 disabled:opacity-50">
                            {generatingLink
                              ? <Loader2 className="h-4 w-4 text-secondary animate-spin" strokeWidth={1.75} />
                              : <Link className="h-4 w-4 text-secondary" strokeWidth={1.75} />}
                            {currentInvoice?.stripePaymentLink ? 'Regenerate Payment Link' : 'Generate Payment Link'}
                          </button>
                        )}
                        <div className="h-px bg-outline-variant/10 my-1" />
                        <button onClick={() => { setShowActionsMenu(false); handleDelete(); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error-container/10 flex items-center gap-3">
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          Delete Invoice
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-error-container/10 border border-error/20 rounded-lg p-4 mb-6 flex items-center gap-3">
            <X className="h-4 w-4 text-error flex-shrink-0" strokeWidth={1.75} />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Status / Date Controls */}
        {isEditing && (
          <div className="bg-surface rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Status</label>
                <select value={status} onChange={(e) => { setStatus(e.target.value as InvoiceStatus); setHasChanges(true); }}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm">
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="viewed">Viewed</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Issue Date</label>
                <input type="date" value={issueDate} onChange={(e) => { setIssueDate(e.target.value); setHasChanges(true); }}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setHasChanges(true); }}
                  className={`w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm ${isOverdue ? 'border-2 border-error' : ''}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Currency</label>
                <select value={currency} onChange={(e) => { setCurrency(e.target.value); setHasChanges(true); }}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                  <option value="DZD">DZD</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Client Info */}
            <div className="bg-surface rounded-lg p-6">
              <h2 className="text-base font-semibold text-on-surface mb-4">Client Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Client Name *', value: clientName, setter: setClientName, type: 'text' },
                  { label: 'Email', value: clientEmail, setter: setClientEmail, type: 'email' },
                  { label: 'Phone', value: clientPhone, setter: setClientPhone, type: 'tel' },
                  { label: 'Company', value: clientCompany, setter: setClientCompany, type: 'text' },
                ].map(({ label, value, setter, type }) => (
                  <div key={label}>
                    <label className="block text-sm font-medium text-on-surface-variant mb-2">{label}</label>
                    <input type={type} value={value} onChange={(e) => { setter(e.target.value); setHasChanges(true); }}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50 text-sm" />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">Address</label>
                  <textarea value={clientAddress} onChange={(e) => { setClientAddress(e.target.value); setHasChanges(true); }}
                    disabled={!isEditing} rows={3}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50 resize-none text-sm" />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-surface rounded-lg p-6">
              <h2 className="text-base font-semibold text-on-surface mb-4">Line Items</h2>
              <LineItemsTable
                items={items}
                currency={currency}
                onChange={(newItems) => {
                  setItems(newItems);
                  setHasChanges(true);
                }}
                readOnly={!isEditing}
                workspaceId={currentInvoice?.workspaceId || currentWorkspaceId || undefined}
              />
            </div>

            {/* Payments */}
            {!isNew && <div className="bg-surface rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-on-surface">
                  Payments
                  {payments.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-on-surface-variant">
                      ({payments.length})
                    </span>
                  )}
                </h2>
                {status !== 'paid' && status !== 'cancelled' && (
                  <button onClick={() => setShowPaymentModal(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-lg transition-colors text-xs font-medium text-on-surface">
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Record Payment
                  </button>
                )}
              </div>

              {payments.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-6">No payments recorded yet.</p>
              ) : (
                <>
                  {/* Progress bar */}
                  {total > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                        <span>{formatCurrency(amountPaid)} paid</span>
                        <span>{Math.round(paidPercent)}%</span>
                      </div>
                      <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success transition-all duration-500"
                          style={{ width: `${paidPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-outline-variant/10">
                          <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant uppercase">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant uppercase">Method</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant uppercase">Reference</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-on-surface-variant uppercase">Amount</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-outline-variant/5 last:border-0">
                            <td className="px-3 py-3 text-sm text-on-surface">{formatDate(payment.paymentDate)}</td>
                            <td className="px-3 py-3 text-sm text-on-surface capitalize">{String(payment.paymentMethod).replace('_', ' ')}</td>
                            <td className="px-3 py-3 text-sm text-on-surface-variant">{payment.referenceNumber || '—'}</td>
                            <td className="px-3 py-3 text-sm text-success font-semibold text-right">{formatCurrency(payment.amount)}</td>
                            <td className="px-3 py-3 text-right">
                              <button onClick={() => handleDeletePayment(payment.id)}
                                className="p-1 text-on-surface-variant hover:text-error transition-colors rounded" aria-label="Remove payment">
                                <X className="h-3.5 w-3.5" strokeWidth={2} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>}

            {/* Notes */}
            <div className="bg-surface rounded-lg p-6">
              <h2 className="text-base font-semibold text-on-surface mb-4">Notes & Terms</h2>
              <div className="space-y-4">
                {[
                  { label: 'Notes', value: notes, setter: setNotes, placeholder: 'Additional notes for the client...' },
                  { label: 'Terms', value: terms, setter: setTerms, placeholder: 'Payment terms and conditions...' },
                  { label: 'Internal Notes (private)', value: internalNotes, setter: setInternalNotes, placeholder: 'Notes for internal use only...' },
                ].map(({ label, value, setter, placeholder }) => (
                  <div key={label}>
                    <label className="block text-sm font-medium text-on-surface-variant mb-2">{label}</label>
                    <textarea value={value} onChange={(e) => { setter(e.target.value); setHasChanges(true); }}
                      disabled={!isEditing} rows={3} placeholder={placeholder}
                      className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50 resize-none text-sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <CalculationsSummary
              subtotal={subtotal} discountType={discountType} discountValue={discountValue}
              discountAmount={discountAmount} taxRate={taxRate} taxAmount={taxAmount}
              total={total} currency={currency}
              amountPaid={amountPaid} amountDue={amountDue} showPaymentStatus={true}
              onDiscountTypeChange={(t) => { setDiscountType(t); setHasChanges(true); }}
              onDiscountValueChange={(v) => { setDiscountValue(v); setHasChanges(true); }}
              onTaxRateChange={(r) => { setTaxRate(r); setHasChanges(true); }}
              readOnly={!isEditing}
            />

            {/* Quick stats */}
            {!isEditing && !isNew && (
              <div className="bg-surface rounded-lg p-5 space-y-3">
                <h3 className="text-sm font-semibold text-on-surface">Details</h3>
                {[
                  { label: 'Issue Date', value: issueDate ? new Date(issueDate).toLocaleDateString() : '—' },
                  { label: 'Due Date', value: dueDate ? new Date(dueDate).toLocaleDateString() : '—', highlight: isOverdue },
                  { label: 'Currency', value: currency },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">{label}</span>
                    <span className={`font-medium ${highlight ? 'text-error' : 'text-on-surface'}`}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-end gap-3">
          {!isNew && hasChanges && (
            <button onClick={() => { if (confirm('Discard unsaved changes?')) fetchInvoice(); }}
              className="px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
              <X className="h-4 w-4" strokeWidth={1.75} />
              Discard
            </button>
          )}
          {isNew ? (
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <FileText className="h-4 w-4" strokeWidth={1.75} />}
              <span>{saving ? 'Creating...' : 'Create Invoice'}</span>
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Save className="h-4 w-4" strokeWidth={1.75} />}
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

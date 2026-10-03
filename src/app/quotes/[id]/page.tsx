'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useDocumentStore } from '@/store/documentStore';
import { useAppStore } from '@/store/appStore';
import StatusBadge from '@/components/documents/StatusBadge';
import { calculateDocumentTotals } from '@/lib/documents/calculations';
import type { QuoteStatus } from '@/components/documents/StatusBadge';
import LineItemsTable, { LineItem } from '@/components/documents/LineItemsTable';
import CalculationsSummary, { DiscountType } from '@/components/documents/CalculationsSummary';
import {
  ArrowLeft, Save, Mail, Download, FileText, MoreVertical, Loader2, X,
  Trash2, Copy, ExternalLink, Check, Send,
} from 'lucide-react';
import type { Quote } from '@/types';
import { useI18n } from '@/i18n/I18nProvider';
import SenderPicker, { useDocumentSender } from '@/components/documents/SenderPicker';

// ─── Send Email Modal ─────────────────────────────────────────────────────────
function SendEmailModal({
  quote,
  onClose,
  onSent,
}: {
  quote: Quote;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useI18n();
  const [to, setTo] = useState(quote.clientEmail || '');
  const [subject, setSubject] = useState(t('quotes.detail.sendModal.subjectDefault', { number: quote.quoteNumber }));
  const [message, setMessage] = useState(
    t('quotes.detail.sendModal.messageDefault', { clientName: quote.clientName })
  );
  const [sending, setSending] = useState(false);
  const sender = useDocumentSender(quote.workspaceId);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!to) { setError(t('quotes.detail.sendModal.recipientRequired')); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message, sendFrom: sender.sendFrom }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || t('quotes.detail.sendModal.failed'));
      }
      onSent();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('quotes.detail.sendModal.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <h2 className="text-lg font-semibold text-on-surface">{t('quotes.detail.sendModal.title')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors">
            <X className="h-5 w-5 text-on-surface-variant" strokeWidth={1.75} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-error bg-error-container/10 px-3 py-2 rounded-lg">{error}</p>}
          <SenderPicker connected={sender.connected} workspaceName={sender.workspaceName} value={sender.sendFrom} onChange={sender.setSendFrom} />
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.detail.sendModal.to')}</label>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.detail.sendModal.subject')}</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.detail.sendModal.message')}</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-outline-variant/10">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors">
            {t('quotes.detail.sendModal.cancel')}
          </button>
          <button onClick={handleSend} disabled={sending}
            className="flex items-center gap-2 px-5 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 transition-colors text-sm font-medium">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Send className="h-4 w-4" strokeWidth={1.75} />}
            <span>{sending ? t('quotes.detail.sendModal.sending') : t('quotes.detail.sendModal.send')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Convert to Invoice Modal ─────────────────────────────────────────────────
function ConvertModal({
  quote,
  onClose,
  onConverted,
}: {
  quote: Quote;
  onClose: () => void;
  onConverted: (invoiceId: string) => void;
}) {
  const { t } = useI18n();
  const [dueDate, setDueDate] = useState('');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    setConverting(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: dueDate || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || t('quotes.detail.convertModal.failed'));
      }
      const data = await res.json();
      onConverted(data.invoice.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('quotes.detail.convertModal.failed'));
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <h2 className="text-lg font-semibold text-on-surface">{t('quotes.detail.convertModal.title')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors">
            <X className="h-5 w-5 text-on-surface-variant" strokeWidth={1.75} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-error bg-error-container/10 px-3 py-2 rounded-lg">{error}</p>}
          <p className="text-sm text-on-surface-variant">
            {t('quotes.detail.convertModal.description', { number: quote.quoteNumber, clientName: quote.clientName })}
          </p>
          <div>
            <label className="block text-sm font-medium text-on-surface-variant mb-2">
              {t('quotes.detail.convertModal.dueDate')} <span className="text-on-surface-variant/60 font-normal">{t('quotes.detail.convertModal.optional')}</span>
            </label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-outline-variant/10">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors">
            {t('quotes.detail.convertModal.cancel')}
          </button>
          <button onClick={handleConvert} disabled={converting}
            className="flex items-center gap-2 px-5 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 transition-colors text-sm font-medium">
            {converting ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <FileText className="h-4 w-4" strokeWidth={1.75} />}
            <span>{converting ? t('quotes.detail.convertModal.converting') : t('quotes.detail.convertModal.convert')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;
  const isNew = quoteId === 'new';

  const { currentQuote, setCurrentQuote, updateQuote, deleteQuote, addQuote } = useDocumentStore();
  const { currentWorkspaceId } = useAppStore();
  const { t } = useI18n();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isNew);
  const [hasChanges, setHasChanges] = useState(isNew);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [status, setStatus] = useState<QuoteStatus>('draft');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchQuote = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) throw new Error(t('quotes.detail.fetchFailed'));
      const data = await response.json();
      const quote = data.quote;
      setCurrentQuote(quote);
      setStatus(quote.status);
      setIssueDate(new Date(quote.issueDate).toISOString().split('T')[0]);
      setValidUntil(quote.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : '');
      setCurrency(quote.currency);
      setClientName(quote.clientName);
      setClientEmail(quote.clientEmail || '');
      setClientPhone(quote.clientPhone || '');
      setClientCompany(quote.clientCompany || '');
      setClientAddress(quote.clientAddress || '');
      setNotes(quote.notes || '');
      setTerms(quote.terms || '');
      setInternalNotes(quote.internalNotes || '');
      setItems(quote.items.map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        total: item.total,
      })));
      setDiscountType((quote.discountType || 'none') as DiscountType);
      setDiscountValue(quote.discountValue || 0);
      setTaxRate(quote.taxRate || 0);
      setIsEditing(quote.status === 'draft');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
  }, [quoteId, isNew, setCurrentQuote, t]);

  useEffect(() => {
    if (!isNew) fetchQuote();
  }, [isNew, fetchQuote]);

  // Totals
  // Shared with the server so the figures shown here are the figures persisted.
  const { subtotal, discountAmount, taxAmount, total } = calculateDocumentTotals(items, {
    taxRate,
    discountType,
    discountValue,
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        status, issueDate, validUntil: validUntil || null, currency,
        clientName, clientEmail: clientEmail || null, clientPhone: clientPhone || null,
        clientCompany: clientCompany || null, clientAddress: clientAddress || null,
        notes: notes || null, terms: terms || null, internalNotes: internalNotes || null,
        discountType: discountType === 'none' ? null : discountType,
        discountValue: discountType === 'none' ? 0 : discountValue,
        taxRate, subtotal, taxAmount, discountAmount, total,
        items: items.map((item) => ({
          id: item.id, description: item.description, quantity: item.quantity,
          unitPrice: item.unitPrice, discount: item.discount, taxRate: item.taxRate, total: item.total,
        })),
      };
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(t('quotes.detail.saveFailed'));
      const data = await response.json();
      setCurrentQuote(data.quote);
      updateQuote(quoteId, data.quote);
      setHasChanges(false);
      showToast(t('quotes.detail.savedToast'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unexpectedError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!clientName.trim()) { setError(t('quotes.detail.clientNameRequired')); return; }
    if (!currentWorkspaceId) { setError(t('quotes.detail.workspaceRequired')); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        workspaceId: currentWorkspaceId,
        clientName, clientEmail: clientEmail || null, clientPhone: clientPhone || null,
        clientCompany: clientCompany || null, clientAddress: clientAddress || null,
        issueDate, validUntil: validUntil || null, currency,
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
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error || t('quotes.detail.createFailed'));
      }
      const data = await response.json();
      addQuote(data.quote);
      router.replace(`/quotes/${data.quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unexpectedError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('quotes.detail.deleteConfirm', { number: currentQuote?.quoteNumber || '' }))) return;
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(t('quotes.detail.deleteFailed'));
      deleteQuote(quoteId);
      router.push('/quotes');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quotes.detail.deleteFailed'));
    }
  };

  const handleDuplicate = async () => {
    if (!currentQuote) return;
    try {
      const payload = {
        workspaceId: currentQuote.workspaceId,
        leadId: currentQuote.leadId,
        clientName: currentQuote.clientName,
        clientEmail: currentQuote.clientEmail,
        clientPhone: currentQuote.clientPhone,
        clientCompany: currentQuote.clientCompany,
        clientAddress: currentQuote.clientAddress,
        issueDate: new Date().toISOString().split('T')[0],
        validUntil: null,
        currency: currentQuote.currency,
        taxRate: currentQuote.taxRate,
        discountType: currentQuote.discountType,
        discountValue: currentQuote.discountValue,
        notes: currentQuote.notes,
        terms: currentQuote.terms,
        internalNotes: currentQuote.internalNotes,
        items: currentQuote.items.map((item) => ({
          description: item.description, quantity: item.quantity,
          unitPrice: item.unitPrice, discount: item.discount,
          taxRate: item.taxRate, total: item.total,
        })),
      };
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(t('quotes.detail.duplicateFailed'));
      const data = await response.json();
      router.push(`/quotes/${data.quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quotes.detail.duplicateFailed'));
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/quotes/${quoteId}/pdf`, '_blank');
  };

  if (loading && !isNew) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      </AppShell>
    );
  }

  if (error && !currentQuote && !isNew) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-error-container/10 border border-error/20 rounded-lg p-6 text-center">
            <p className="text-error mb-4">{error}</p>
            <button onClick={() => router.back()} className="px-4 py-2 bg-error text-on-error rounded-lg hover:opacity-90 text-sm font-medium">
              {t('quotes.detail.goBackButton')}
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-surface rounded-lg shadow-xl border border-outline-variant/10 text-sm font-medium text-on-surface animate-in slide-in-from-top-2">
          <Check className="h-4 w-4 text-success" strokeWidth={2} />
          {toast}
        </div>
      )}

      {showSendModal && currentQuote && (
        <SendEmailModal
          quote={currentQuote}
          onClose={() => setShowSendModal(false)}
          onSent={() => {
            showToast('Quote sent successfully');
            fetchQuote();
          }}
        />
      )}

      {showConvertModal && currentQuote && (
        <ConvertModal
          quote={currentQuote}
          onClose={() => setShowConvertModal(false)}
          onConverted={(invoiceId) => {
            showToast('Converted to invoice successfully');
            router.push(`/invoices/${invoiceId}`);
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
                {isNew ? 'New Quote' : (currentQuote?.quoteNumber || 'Quote')}
              </h1>
              {!isNew && (
                <div className="flex items-center gap-3">
                  <StatusBadge status={status} type="quote" />
                  {currentQuote?.lead && (
                    <span className="text-xs text-on-surface-variant">
                      {currentQuote.lead.firstName} {currentQuote.lead.lastName}
                    </span>
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
                <button onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface hover:bg-surface-container-high rounded-lg transition-colors text-sm font-medium">
                  <Mail className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">{t('misc.actionSend')}</span>
                </button>
                <button onClick={handleDownloadPDF}
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
                      <div className="absolute right-0 top-full mt-2 z-20 w-52 bg-surface rounded-lg shadow-xl border border-outline-variant/10 py-1 overflow-hidden">
                        <button onClick={() => { setShowActionsMenu(false); setIsEditing(true); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3">
                          <FileText className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
                          Edit Quote
                        </button>
                        <button onClick={() => { setShowActionsMenu(false); setShowConvertModal(true); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3">
                          <ExternalLink className="h-4 w-4 text-secondary" strokeWidth={1.75} />
                          Convert to Invoice
                        </button>
                        <button onClick={() => { setShowActionsMenu(false); handleDuplicate(); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3">
                          <Copy className="h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
                          Duplicate Quote
                        </button>
                        <div className="h-px bg-outline-variant/10 my-1" />
                        <button onClick={() => { setShowActionsMenu(false); handleDelete(); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error-container/10 flex items-center gap-3">
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          Delete Quote
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

        {/* Status and Date Controls */}
        {isEditing && (
          <div className="bg-surface rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('misc.statusLabel')}</label>
                <select value={status} onChange={(e) => { setStatus(e.target.value as QuoteStatus); setHasChanges(true); }}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm">
                  <option value="draft">{t('misc.statusDraft')}</option>
                  <option value="sent">{t('misc.statusSent')}</option>
                  <option value="viewed">{t('misc.statusViewed')}</option>
                  <option value="accepted">{t('misc.statusAccepted')}</option>
                  <option value="rejected">{t('misc.statusRejected')}</option>
                  <option value="expired">{t('misc.statusExpired')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Issue Date</label>
                <input type="date" value={issueDate} onChange={(e) => { setIssueDate(e.target.value); setHasChanges(true); }}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-2">Valid Until</label>
                <input type="date" value={validUntil} onChange={(e) => { setValidUntil(e.target.value); setHasChanges(true); }}
                  className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm" />
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
                workspaceId={currentQuote?.workspaceId || currentWorkspaceId || undefined}
              />
            </div>

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
              onDiscountTypeChange={(t) => { setDiscountType(t); setHasChanges(true); }}
              onDiscountValueChange={(v) => { setDiscountValue(v); setHasChanges(true); }}
              onTaxRateChange={(r) => { setTaxRate(r); setHasChanges(true); }}
              readOnly={!isEditing}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-end gap-3">
          {!isNew && hasChanges && (
            <button onClick={() => { if (confirm('Discard unsaved changes?')) fetchQuote(); }}
              className="px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
              <X className="h-4 w-4" strokeWidth={1.75} />
              Discard
            </button>
          )}
          {isNew ? (
            <button onClick={handleCreate} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <FileText className="h-4 w-4" strokeWidth={1.75} />}
              <span>{saving ? 'Creating...' : 'Create Quote'}</span>
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

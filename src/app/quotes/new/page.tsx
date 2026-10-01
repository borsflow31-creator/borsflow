'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useAppStore } from '@/store/appStore';
import { useDocumentStore } from '@/store/documentStore';
import { useI18n } from '@/i18n/I18nProvider';
import LineItemsTable, { LineItem } from '@/components/documents/LineItemsTable';
import { calculateDocumentTotals } from '@/lib/documents/calculations';
import CalculationsSummary, { DiscountType } from '@/components/documents/CalculationsSummary';
import {
  ArrowLeft,
  Save,
  Loader2,
  Search,
  User,
  X,
  Plus,
} from 'lucide-react';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}

function NewQuotePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentWorkspaceId } = useAppStore();
  const { addQuote } = useDocumentStore();
  const { t } = useI18n();

  const CURRENCIES = [
    { value: 'USD', label: t('quotes.currency.usd') },
    { value: 'EUR', label: t('quotes.currency.eur') },
    { value: 'GBP', label: t('quotes.currency.gbp') },
    { value: 'CAD', label: t('quotes.currency.cad') },
    { value: 'AUD', label: t('quotes.currency.aud') },
    { value: 'DZD', label: t('quotes.currency.dzd') },
    { value: 'MAD', label: t('quotes.currency.mad') },
    { value: 'TND', label: t('quotes.currency.tnd') },
  ];

  const workspaceId = searchParams.get('workspace') || currentWorkspaceId || '';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client selection
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Form fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Line items
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, total: 0 },
  ]);
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(0);

  // Load leads for CRM client picker
  useEffect(() => {
    if (workspaceId) {
      fetch(`/api/leads?workspaceId=${workspaceId}&limit=100`)
        .then((r) => r.json())
        .then((d) => setLeads(d.leads || []))
        .catch(() => {});
    }
  }, [workspaceId]);

  const filteredLeads = leads.filter((l) => {
    const q = leadSearch.toLowerCase();
    return (
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.company?.toLowerCase().includes(q)
    );
  });

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setClientName(`${lead.firstName} ${lead.lastName}`);
    setClientEmail(lead.email || '');
    setClientPhone(lead.phone || '');
    setClientCompany(lead.company || '');
    setShowLeadPicker(false);
    setLeadSearch('');
  };

  const handleClearLead = () => {
    setSelectedLead(null);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientCompany('');
  };

  // Calculate totals
  // Shared with the server so the figures shown here are the figures persisted.
  const { subtotal, discountAmount, taxAmount, total } = calculateDocumentTotals(items, {
    taxRate,
    discountType,
    discountValue,
  });

  const handleSave = async () => {
    if (!clientName.trim()) {
      setError(t('quotes.newForm.clientNameRequired'));
      return;
    }
    if (items.every((i) => !i.description.trim())) {
      setError(t('quotes.newForm.lineItemRequired'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        workspaceId,
        leadId: selectedLead?.id || null,
        clientName,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        clientCompany: clientCompany || null,
        clientAddress: clientAddress || null,
        issueDate,
        validUntil: validUntil || null,
        currency,
        taxRate,
        discountType: discountType === 'none' ? null : discountType,
        discountValue: discountType === 'none' ? 0 : discountValue,
        notes: notes || null,
        terms: terms || null,
        internalNotes: internalNotes || null,
        items: items.filter((i) => i.description.trim()).map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          total: item.total,
        })),
      };

      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('quotes.newForm.createFailed'));
      }

      const data = await response.json();
      addQuote(data.quote);
      router.push(`/quotes/${data.quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unexpectedError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
              aria-label={t('quotes.newForm.backAria')}
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">{t('quotes.newForm.title')}</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">{t('quotes.newForm.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Save className="h-4 w-4" strokeWidth={1.75} />
            )}
            <span>{saving ? t('quotes.newForm.creating') : t('quotes.newForm.createQuote')}</span>
          </button>
        </div>

        {error && (
          <div className="bg-error-container/10 border border-error/20 rounded-lg p-4 mb-6 flex items-center gap-3">
            <X className="h-4 w-4 text-error flex-shrink-0" strokeWidth={1.75} />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Document Settings */}
        <div className="bg-surface rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-on-surface mb-4">{t('quotes.newForm.documentSettings')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                {t('quotes.newForm.issueDate')}
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                {t('quotes.newForm.validUntil')}
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                {t('quotes.newForm.currency')}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Client Information */}
            <div className="bg-surface rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-on-surface">{t('quotes.newForm.clientInformation')}</h2>
                {selectedLead ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 rounded-lg">
                    <User className="h-3.5 w-3.5 text-secondary" strokeWidth={1.75} />
                    <span className="text-xs text-secondary font-medium">
                      {t('quotes.newForm.linkedContact', { name: `${selectedLead.firstName} ${selectedLead.lastName}` })}
                    </span>
                    <button
                      onClick={handleClearLead}
                      className="text-secondary hover:text-on-surface transition-colors"
                      aria-label={t('quotes.newForm.removeLinkedContactAria')}
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setShowLeadPicker(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container-high rounded-lg transition-colors text-xs font-medium text-on-surface-variant"
                    >
                      <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {t('quotes.newForm.linkCrmContact')}
                    </button>

                    {showLeadPicker && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowLeadPicker(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 z-20 w-72 bg-surface rounded-lg shadow-xl border border-outline-variant/10 overflow-hidden">
                          <div className="p-3 border-b border-outline-variant/10">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" strokeWidth={1.75} />
                              <input
                                type="text"
                                value={leadSearch}
                                onChange={(e) => setLeadSearch(e.target.value)}
                                placeholder={t('quotes.newForm.searchContactsPlaceholder')}
                                className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {filteredLeads.length === 0 ? (
                              <p className="text-center text-sm text-on-surface-variant py-6">{t('quotes.newForm.noContactsFound')}</p>
                            ) : (
                              filteredLeads.map((lead) => (
                                <button
                                  key={lead.id}
                                  onClick={() => handleSelectLead(lead)}
                                  className="w-full px-4 py-3 text-left hover:bg-surface-container-low transition-colors border-b border-outline-variant/5 last:border-0"
                                >
                                  <p className="text-sm font-medium text-on-surface">
                                    {lead.firstName} {lead.lastName}
                                  </p>
                                  <p className="text-xs text-on-surface-variant mt-0.5">
                                    {lead.company || lead.email || '—'}
                                  </p>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">
                    {t('quotes.newForm.clientName')} <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder={t('quotes.newForm.clientNamePlaceholder')}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.newForm.email')}</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder={t('quotes.newForm.emailPlaceholder')}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.newForm.phone')}</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder={t('quotes.newForm.phonePlaceholder')}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.newForm.company')}</label>
                  <input
                    type="text"
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    placeholder={t('quotes.newForm.companyPlaceholder')}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.newForm.address')}</label>
                  <textarea
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows={2}
                    placeholder={t('quotes.newForm.addressPlaceholder')}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-surface rounded-lg p-6">
              <h2 className="text-base font-semibold text-on-surface mb-4">{t('quotes.newForm.lineItems')}</h2>
              <LineItemsTable
                items={items}
                currency={currency}
                onChange={setItems}
                readOnly={false}
                workspaceId={workspaceId}
              />
            </div>

            {/* Notes & Terms */}
            <div className="bg-surface rounded-lg p-6">
              <h2 className="text-base font-semibold text-on-surface mb-4">{t('quotes.newForm.notesAndTerms')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.newForm.notes')}</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder={t('quotes.newForm.notesPlaceholder')}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">{t('quotes.newForm.terms')}</label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    rows={3}
                    placeholder={t('quotes.newForm.termsPlaceholder')}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">
                    {t('quotes.newForm.internalNotes')}
                    <span className="ml-2 text-xs text-on-surface-variant/60 font-normal">{t('quotes.newForm.internalNotesPrivate')}</span>
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={2}
                    placeholder={t('quotes.newForm.internalNotesPlaceholder')}
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            <CalculationsSummary
              subtotal={subtotal}
              discountType={discountType}
              discountValue={discountValue}
              discountAmount={discountAmount}
              taxRate={taxRate}
              taxAmount={taxAmount}
              total={total}
              currency={currency}
              onDiscountTypeChange={setDiscountType}
              onDiscountValueChange={setDiscountValue}
              onTaxRateChange={setTaxRate}
              readOnly={false}
            />

            {/* Create Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              )}
              <span>{saving ? t('quotes.newForm.creating') : t('quotes.newForm.createQuote')}</span>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewQuotePage() {
  return (
    <Suspense>
      <NewQuotePageInner />
    </Suspense>
  );
}

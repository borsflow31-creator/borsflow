'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useAppStore } from '@/store/appStore';
import { useDocumentStore } from '@/store/documentStore';
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

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'DZD', label: 'DZD — Algerian Dinar' },
  { value: 'MAD', label: 'MAD — Moroccan Dirham' },
  { value: 'TND', label: 'TND — Tunisian Dinar' },
];

function NewQuotePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentWorkspaceId } = useAppStore();
  const { addQuote } = useDocumentStore();

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
      setError('Client name is required');
      return;
    }
    if (items.every((i) => !i.description.trim())) {
      setError('At least one line item with a description is required');
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
        throw new Error(data.error || 'Failed to create quote');
      }

      const data = await response.json();
      addQuote(data.quote);
      router.push(`/quotes/${data.quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">New Quote</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">Create a new quote for a client</p>
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
            <span>{saving ? 'Creating...' : 'Create Quote'}</span>
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
          <h2 className="text-base font-semibold text-on-surface mb-4">Document Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                Issue Date
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
                Valid Until
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
                Currency
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
                <h2 className="text-base font-semibold text-on-surface">Client Information</h2>
                {selectedLead ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 rounded-lg">
                    <User className="h-3.5 w-3.5 text-secondary" strokeWidth={1.75} />
                    <span className="text-xs text-secondary font-medium">
                      Linked: {selectedLead.firstName} {selectedLead.lastName}
                    </span>
                    <button
                      onClick={handleClearLead}
                      className="text-secondary hover:text-on-surface transition-colors"
                      aria-label="Remove linked contact"
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
                      Link CRM Contact
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
                                placeholder="Search contacts..."
                                className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {filteredLeads.length === 0 ? (
                              <p className="text-center text-sm text-on-surface-variant py-6">No contacts found</p>
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
                    Client Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">Email</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">Phone</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">Company</label>
                  <input
                    type="text"
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    placeholder="Company name"
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">Address</label>
                  <textarea
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    rows={2}
                    placeholder="123 Street, City, Country"
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-surface rounded-lg p-6">
              <h2 className="text-base font-semibold text-on-surface mb-4">Line Items</h2>
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
              <h2 className="text-base font-semibold text-on-surface mb-4">Notes & Terms</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Additional notes for the client..."
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">Terms</label>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    rows={3}
                    placeholder="Payment terms and conditions..."
                    className="w-full px-3 py-2 bg-surface-container-low rounded-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-2">
                    Internal Notes
                    <span className="ml-2 text-xs text-on-surface-variant/60 font-normal">(private)</span>
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={2}
                    placeholder="Notes for internal use only..."
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
              <span>{saving ? 'Creating...' : 'Create Quote'}</span>
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

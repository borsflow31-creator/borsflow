import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Quote, Invoice, QuoteItem, InvoiceItem } from '@/types';

interface DocumentState {
  // Quotes
  quotes: Quote[];
  currentQuote: Quote | null;
  setCurrentQuote: (quote: Quote | null) => void;
  setQuotes: (quotes: Quote[]) => void;
  addQuote: (quote: Quote) => void;
  updateQuote: (id: string, quote: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;

  // Invoices
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  setCurrentInvoice: (invoice: Invoice | null) => void;
  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;

  // UI State
  quotesViewMode: 'grid' | 'table';
  setQuotesViewMode: (mode: 'grid' | 'table') => void;
  invoicesViewMode: 'grid' | 'table';
  setInvoicesViewMode: (mode: 'grid' | 'table') => void;

  // Filters
  quotesStatusFilter: string;
  setQuotesStatusFilter: (status: string) => void;
  invoicesStatusFilter: string;
  setInvoicesStatusFilter: (status: string) => void;

  // Search
  quotesSearchQuery: string;
  setQuotesSearchQuery: (query: string) => void;
  invoicesSearchQuery: string;
  setInvoicesSearchQuery: (query: string) => void;

  // Sort
  quotesSortBy: string;
  setQuotesSortBy: (sort: string) => void;
  invoicesSortBy: string;
  setInvoicesSortBy: (sort: string) => void;
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set) => ({
      // Quotes
      quotes: [],
      currentQuote: null,
      setCurrentQuote: (quote) => set({ currentQuote: quote }),
      setQuotes: (quotes) => set({ quotes }),
      addQuote: (quote) => set((state) => ({ quotes: [...state.quotes, quote] })),
      updateQuote: (id, updatedQuote) =>
        set((state) => ({
          quotes: state.quotes.map((quote) =>
            quote.id === id ? { ...quote, ...updatedQuote } : quote
          ),
          currentQuote:
            state.currentQuote?.id === id
              ? { ...state.currentQuote, ...updatedQuote }
              : state.currentQuote,
        })),
      deleteQuote: (id) =>
        set((state) => ({
          quotes: state.quotes.filter((quote) => quote.id !== id),
          currentQuote: state.currentQuote?.id === id ? null : state.currentQuote,
        })),

      // Invoices
      invoices: [],
      currentInvoice: null,
      setCurrentInvoice: (invoice) => set({ currentInvoice: invoice }),
      setInvoices: (invoices) => set({ invoices }),
      addInvoice: (invoice) => set((state) => ({ invoices: [...state.invoices, invoice] })),
      updateInvoice: (id, updatedInvoice) =>
        set((state) => ({
          invoices: state.invoices.map((invoice) =>
            invoice.id === id ? { ...invoice, ...updatedInvoice } : invoice
          ),
          currentInvoice:
            state.currentInvoice?.id === id
              ? { ...state.currentInvoice, ...updatedInvoice }
              : state.currentInvoice,
        })),
      deleteInvoice: (id) =>
        set((state) => ({
          invoices: state.invoices.filter((invoice) => invoice.id !== id),
          currentInvoice:
            state.currentInvoice?.id === id ? null : state.currentInvoice,
        })),

      // UI State
      quotesViewMode: 'grid',
      setQuotesViewMode: (mode) => set({ quotesViewMode: mode }),
      invoicesViewMode: 'grid',
      setInvoicesViewMode: (mode) => set({ invoicesViewMode: mode }),

      // Filters
      quotesStatusFilter: 'all',
      setQuotesStatusFilter: (status) => set({ quotesStatusFilter: status }),
      invoicesStatusFilter: 'all',
      setInvoicesStatusFilter: (status) => set({ invoicesStatusFilter: status }),

      // Search
      quotesSearchQuery: '',
      setQuotesSearchQuery: (query) => set({ quotesSearchQuery: query }),
      invoicesSearchQuery: '',
      setInvoicesSearchQuery: (query) => set({ invoicesSearchQuery: query }),

      // Sort
      quotesSortBy: 'date',
      setQuotesSortBy: (sort) => set({ quotesSortBy: sort }),
      invoicesSortBy: 'date',
      setInvoicesSortBy: (sort) => set({ invoicesSortBy: sort }),
    }),
    {
      name: 'document-storage',
      partialize: (state) => ({
        quotesViewMode: state.quotesViewMode,
        invoicesViewMode: state.invoicesViewMode,
        quotesStatusFilter: state.quotesStatusFilter,
        invoicesStatusFilter: state.invoicesStatusFilter,
        quotesSortBy: state.quotesSortBy,
        invoicesSortBy: state.invoicesSortBy,
      }),
    }
  )
);

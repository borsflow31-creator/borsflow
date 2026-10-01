'use client';

import React, { useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { X, Wand2, Loader2, Star, FileText, DollarSign, Receipt, Columns, BookOpen, CheckCircle2, ChevronRight } from 'lucide-react';
import { UniversalTemplate, TemplateType } from '@/types';

// ─── Block preview renderer ────────────────────────────────────────────────────

function BlockPreview({ block }: { block: { type: string; content: any } }) {
  const c = typeof block.content === 'string'
    ? (() => { try { return JSON.parse(block.content) } catch { return {} } })()
    : block.content || {};

  switch (block.type) {
    case 'heading':
      return <h3 className="text-xl font-bold text-on-surface mt-6 mb-3 tracking-tight">{c.text}</h3>;
    case 'subheading':
      return <h4 className="text-base font-semibold text-on-surface mt-4 mb-2">{c.text}</h4>;
    case 'text':
      return <p className="text-sm text-on-surface-variant leading-relaxed mb-3">{c.text}</p>;
    case 'bullet':
      return (
        <li className="text-sm text-on-surface-variant ml-5 mb-1.5 flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 mt-2 shrink-0" />
          <span>{c.text}</span>
        </li>
      );
    case 'numbered':
      return <li className="text-sm text-on-surface-variant ml-6 mb-1.5 list-decimal marker:text-on-surface-variant/60 font-medium">{c.text}</li>;
    case 'todo':
      return (
        <div className="flex items-start gap-3 text-sm text-on-surface-variant mb-2 group cursor-default">
          <div className={`mt-0.5 shrink-0 flex items-center justify-center w-4 h-4 rounded border transition-colors ${c.checked ? 'bg-secondary border-secondary text-on-secondary' : 'border-outline-variant group-hover:border-secondary/50'}`}>
            {c.checked && <CheckCircle2 className="w-3 h-3" />}
          </div>
          <span className={`${c.checked ? 'line-through opacity-50' : ''} leading-tight pt-0.5`}>{c.text}</span>
        </div>
      );
    case 'divider':
      return <div className="h-px bg-gradient-to-r from-transparent via-outline-variant to-transparent my-6" />;
    case 'callout':
      return (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/50 shadow-sm mb-4">
          <span className="text-xl shrink-0 drop-shadow-sm">{c.icon || '💡'}</span>
          <p className="text-sm text-on-surface-variant leading-relaxed pt-0.5">{c.text}</p>
        </div>
      );
    case 'quote':
      return (
        <blockquote className="relative p-4 pl-5 my-5 bg-surface-container-low/50 rounded-r-xl border-l-4 border-secondary text-sm italic text-on-surface-variant">
          <div className="absolute top-2 left-2 text-4xl text-secondary/10 font-serif leading-none">&quot;</div>
          <p className="relative z-10">{c.text}</p>
        </blockquote>
      );
    default:
      return c.text ? <p className="text-sm text-on-surface-variant mb-3">{c.text}</p> : null;
  }
}

// ─── Per-type content previews ─────────────────────────────────────────────────

function PagePreview({ content }: { content: any }) {
  const blocks: any[] = content.blocks || [];
  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto bg-surface shadow-sm ring-1 ring-outline-variant/30 rounded-2xl my-6">
      {content.title && (
        <div className="mb-8 pb-6 border-b border-outline-variant/30">
          {content.icon && <div className="text-5xl mb-4 drop-shadow-sm">{content.icon}</div>}
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">{content.title}</h2>
        </div>
      )}
      <div className="space-y-1">
        {blocks.slice(0, 20).map((block, i) => (
          <BlockPreview key={i} block={block} />
        ))}
        {blocks.length > 20 && (
          <div className="mt-8 pt-4 border-t border-outline-variant/30 text-center">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary bg-secondary/10 px-3 py-1.5 rounded-full">
              +{blocks.length - 20} more blocks <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function QuoteInvoicePreview({ content, type }: { content: any; type: 'quote' | 'invoice' }) {
  const { t } = useI18n();
  const items: any[] = content.items || [];
  const subtotal = items.reduce((s: number, i: any) => s + (i.quantity || 1) * (i.unitPrice || 0), 0);
  const taxAmount = subtotal * ((content.taxRate || 0) / 100);
  const total = subtotal + taxAmount;
  const isQuote = type === 'quote';

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto bg-surface shadow-md ring-1 ring-outline-variant/50 rounded-2xl my-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-10 pb-8 border-b border-outline-variant/40">
        <div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 ${
            isQuote ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                    : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {isQuote ? <DollarSign className="h-5 w-5" strokeWidth={2} /> : <Receipt className="h-5 w-5" strokeWidth={2} />}
            <span className="text-sm font-bold tracking-widest uppercase">{type}</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface">
            {content.title || `${isQuote ? 'Quote' : 'Invoice'} Template`}
          </h2>
        </div>
        
        {/* Mock Company Info */}
        <div className="text-right text-sm text-on-surface-variant space-y-1">
          <p className="font-semibold text-on-surface">{t('misc.yourCompany')}</p>
          <p>123 Business Rd.</p>
          <p>{t('misc.companyAddress')}</p>
        </div>
      </div>

      {/* Line items */}
      <div className="mb-8 rounded-xl border border-outline-variant/50 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('misc.itemDescription')}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-20">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-32">{t('misc.rateLabel')}</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-32">{t('misc.amountLabel')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {items.map((item: any, i: number) => (
              <tr key={i} className="hover:bg-surface-container-lowest/50 transition-colors">
                <td className="px-4 py-3.5 text-on-surface font-medium">{item.description || 'Item description'}</td>
                <td className="px-4 py-3.5 text-right text-on-surface-variant">{item.quantity || 1}</td>
                <td className="px-4 py-3.5 text-right text-on-surface-variant">
                  ${(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3.5 text-right text-on-surface font-semibold">
                  ${((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-on-surface-variant italic">No items added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Area */}
      <div className="flex flex-col sm:flex-row justify-between gap-8">
        {/* Notes */}
        <div className="flex-1">
          {content.notes && (
            <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Notes & Terms</p>
              <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">{content.notes}</p>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="w-full sm:w-64 space-y-3">
          <div className="flex justify-between text-sm text-on-surface-variant px-2">
            <span>{t('misc.subtotalLabel')}</span>
            <span className="font-medium text-on-surface">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          {content.taxRate > 0 && (
            <div className="flex justify-between text-sm text-on-surface-variant px-2">
              <span>Tax ({content.taxRate}%)</span>
              <span className="font-medium text-on-surface">${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-base font-bold text-on-surface border-t-2 border-outline-variant/50 pt-3 px-2">
            <span>{t('misc.totalLabel')}</span>
            <span className={isQuote ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}>
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanPreview({ content }: { content: any }) {
  const cards: any[] = content.cards || [];
  const todo = cards.filter((c) => c.status === 'todo');
  const inprogress = cards.filter((c) => c.status === 'inprogress');
  const done = cards.filter((c) => c.status === 'done');

  const Column = ({ title, items, color, bg, border }: { title: string; items: any[]; color: string; bg: string; border: string }) => (
    <div className={`flex-1 min-w-[260px] max-w-[320px] rounded-xl flex flex-col h-full bg-surface-container/30 border border-outline-variant/30 overflow-hidden`}>
      <div className={`px-4 py-3 flex items-center justify-between border-b ${border} ${bg}`}>
        <h3 className={`text-sm font-bold ${color}`}>{title}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-surface shadow-sm ${color}`}>
          {items.length}
        </span>
      </div>
      <div className="p-3 space-y-3 flex-1 bg-surface-container-lowest/50">
        {items.slice(0, 5).map((card, i) => (
          <div key={i} className="bg-surface rounded-xl p-3.5 shadow-sm border border-outline-variant/50 hover:border-secondary/50 hover:shadow-md transition-all cursor-default group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm text-on-surface font-semibold leading-tight group-hover:text-secondary transition-colors">{card.title}</p>
            </div>
            {card.description && (
              <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{card.description}</p>
            )}
            <div className="flex items-center justify-between mt-auto">
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${
                card.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30' :
                card.priority === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30' :
                'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
              }`}>
                {card.priority || 'Medium'}
              </span>
              <div className="w-6 h-6 rounded-full bg-surface-container border border-outline-variant flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
                U
              </div>
            </div>
          </div>
        ))}
        {items.length > 5 && (
          <button className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-on-surface-variant bg-surface-container-low hover:bg-surface-container rounded-lg border border-dashed border-outline-variant transition-colors">
            +{items.length - 5} more cards
          </button>
        )}
        {items.length === 0 && (
          <div className="h-24 flex items-center justify-center text-xs text-on-surface-variant border-2 border-dashed border-outline-variant/50 rounded-xl">
            Drop cards here
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6 bg-surface p-5 rounded-2xl border border-outline-variant/40 shadow-sm flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner"
          style={{ backgroundColor: content.projectColor || '#6366f1', color: '#fff' }}
        >
          <Columns className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface">{content.projectName || 'Project Board'}</h2>
          {content.description && (
            <p className="text-sm text-on-surface-variant mt-1">{content.description}</p>
          )}
        </div>
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        <Column 
          title="To Do" 
          items={todo} 
          color="text-slate-700 dark:text-slate-300" 
          bg="bg-slate-50 dark:bg-slate-900/40" 
          border="border-slate-200 dark:border-slate-800" 
        />
        <Column 
          title="In Progress" 
          items={inprogress} 
          color="text-blue-700 dark:text-blue-400" 
          bg="bg-blue-50/50 dark:bg-blue-900/20" 
          border="border-blue-100 dark:border-blue-900/30" 
        />
        <Column 
          title="Done" 
          items={done} 
          color="text-emerald-700 dark:text-emerald-400" 
          bg="bg-emerald-50/50 dark:bg-emerald-900/20" 
          border="border-emerald-100 dark:border-emerald-900/30" 
        />
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

interface TemplatePreviewPanelProps {
  template: UniversalTemplate;
  workspaceId: string;
  onClose: () => void;
  onApply: (template: UniversalTemplate) => void;
  onAICustomize: (template: UniversalTemplate) => void;
  applying?: boolean;
}

export default function TemplatePreviewPanel({
  template,
  workspaceId,
  onClose,
  onApply,
  onAICustomize,
  applying,
}: TemplatePreviewPanelProps) {
  const { t } = useI18n();
  const content = useMemo(() => {
    try { return JSON.parse(template.content) } catch { return {} }
  }, [template.content]);

  const renderPreview = () => {
    switch (template.type as TemplateType) {
      case 'page':    return <PagePreview content={content} />;
      case 'quote':   return <QuoteInvoicePreview content={content} type="quote" />;
      case 'invoice': return <QuoteInvoicePreview content={content} type="invoice" />;
      case 'kanban':  return <KanbanPreview content={content} />;
      default:        return <div className="p-8 text-center text-sm text-on-surface-variant italic bg-surface rounded-xl m-6 border border-outline-variant/50">No rich preview available for this template.</div>;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface-container-lowest/30 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border-b border-outline-variant/50 bg-surface/80 backdrop-blur-md sticky top-0 z-20 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-2xl shrink-0 shadow-sm border border-outline-variant/50">
            {template.icon || '📄'}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-on-surface leading-tight truncate">{template.name}</h3>
            {template.description && (
              <p className="text-sm text-on-surface-variant mt-0.5 truncate">{template.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {template.isSystem && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-900/50">
                  <Star className="h-3 w-3 fill-amber-500/30" /> Official
                </span>
              )}
              {template.category && (
                <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1.5">
                  <span className="opacity-80">{template.category.icon}</span> {template.category.name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Content preview */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-container-low/50 relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        {renderPreview()}
      </div>

      {/* Footer actions */}
      <div className="p-5 border-t border-outline-variant/50 bg-surface/80 backdrop-blur-md sticky bottom-0 z-20 flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => onApply(template)}
          disabled={applying}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-xl hover:bg-secondary-dim hover:shadow-lg disabled:opacity-50 transition-all duration-300 font-bold text-sm"
        >
          {applying ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Applying Template…</>
          ) : (
            <><BookOpen className="h-5 w-5" strokeWidth={2} /> Use This Template</>
          )}
        </button>
        <button
          onClick={() => onAICustomize(template)}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-surface border-2 border-outline-variant hover:border-secondary hover:bg-secondary/5 text-on-surface rounded-xl transition-all duration-300 font-bold text-sm group"
        >
          <Wand2 className="h-5 w-5 text-secondary group-hover:rotate-12 transition-transform" strokeWidth={2} />
          Customize with AI
        </button>
      </div>
    </div>
  );
}

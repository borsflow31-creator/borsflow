'use client';

import React from 'react';
import { FileText, DollarSign, Receipt, Columns, Zap, Star, LayoutTemplate, Eye } from 'lucide-react';
import { UniversalTemplate, TemplateType } from '@/types';

const TYPE_CONFIG: Record<TemplateType, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  page:    { label: 'Page',    color: 'text-neutral-600 dark:text-neutral-400',  bg: 'bg-neutral-100 dark:bg-neutral-800/50',  icon: FileText },
  quote:   { label: 'Quote',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: DollarSign },
  invoice: { label: 'Invoice', color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-900/20',      icon: Receipt },
  kanban:  { label: 'Kanban',  color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-900/20',  icon: Columns },
};

interface TemplateCardProps {
  template: UniversalTemplate;
  onSelect: (t: UniversalTemplate) => void;
  onApply: (t: UniversalTemplate) => void;
  applying?: boolean;
}

export default function TemplateCard({ template, onSelect, onApply, applying }: TemplateCardProps) {
  const cfg = TYPE_CONFIG[template.type as TemplateType] ?? { label: 'Template', color: 'text-neutral-600', bg: 'bg-neutral-100', icon: LayoutTemplate };
  const Icon = cfg.icon;

  return (
    <div className="group relative flex flex-col h-full w-full">
      {/* Image Container */}
      <div 
        className={`relative aspect-[3/4] sm:aspect-[4/5] w-full rounded-xl overflow-hidden cursor-pointer ${cfg.bg} border border-outline-variant/30`}
        onClick={() => onSelect(template)}
      >
        {template.previewImage ? (
          <img 
            src={template.previewImage} 
            alt={template.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full opacity-80 transition-transform duration-500 group-hover:scale-105">
            <span className="text-6xl drop-shadow-sm mb-4">{template.icon || '📄'}</span>
            <Icon className={`h-8 w-8 ${cfg.color} opacity-60`} strokeWidth={1.5} />
          </div>
        )}

        {/* Badges on top left */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          <span className="px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold bg-surface/90 text-on-surface shadow-sm backdrop-blur-md">
            {cfg.label}
          </span>
          {template.isSystem && (
            <span className="px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold bg-amber-500/90 text-white shadow-sm backdrop-blur-md flex items-center gap-1">
              <Star className="h-3 w-3 fill-white" /> Pro
            </span>
          )}
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20 backdrop-blur-[1px]">
          <button 
            className="px-6 py-2.5 bg-primary text-on-primary font-medium rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2 hover:bg-primary/90"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(template);
            }}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>
      </div>

      {/* Details below image */}
      <div className="mt-3 px-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
            {template.name}
          </h3>
          {!template.isSystem && (
            <div className="shrink-0 text-on-surface-variant opacity-70" title="Custom Template">
               <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

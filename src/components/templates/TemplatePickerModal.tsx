'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { X, Search, Loader2 } from 'lucide-react';
import { UniversalTemplate, TemplateType } from '@/types';
import TemplateCard from './TemplateCard';
import { useRouter } from 'next/navigation';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: TemplateType;
  workspaceId: string;
}

const TYPE_LABELS: Record<TemplateType, string> = {
  page:    'Page Templates',
  quote:   'Quote Templates',
  invoice: 'Invoice Templates',
  kanban:  'Kanban Board Templates',
};

export default function TemplatePickerModal({
  isOpen,
  onClose,
  type,
  workspaceId,
}: TemplatePickerModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [templates, setTemplates] = useState<UniversalTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ workspaceId, type });
      const res = await fetch(`/api/templates?${params}`);
      if (!res.ok) throw new Error('Failed to load templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, type]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setSearch('');
    }
  }, [isOpen, fetchTemplates]);

  const handleApply = async (template: UniversalTemplate) => {
    setApplyingId(template.id);
    try {
      const res = await fetch(`/api/templates/${template.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply template');
      onClose();
      router.push(data.redirect);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplyingId(null);
    }
  };

  const filtered = templates.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-outline-variant">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h2 className="text-base font-semibold text-on-surface">{TYPE_LABELS[type]}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-container rounded-lg transition-colors">
            <X className="h-4 w-4 text-on-surface-variant" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" strokeWidth={1.5} />
            <input
              type="text"
              placeholder={t('misc.searchTemplates')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-secondary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-error">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-on-surface-variant">
              {search ? 'No templates match your search.' : 'No templates available.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => {}} // no preview in picker
                  onApply={handleApply}
                  applying={applyingId === template.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-outline-variant flex items-center justify-between">
          <p className="text-xs text-on-surface-variant">{filtered.length} template{filtered.length !== 1 ? 's' : ''}</p>
          <button onClick={onClose} className="px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

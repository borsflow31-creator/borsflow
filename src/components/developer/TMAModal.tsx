'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';

interface TMAModalProps {
  workspaceId: string;
  lot: any;
  onClose: () => void;
  onSuccess: (newTma: any) => void;
}

export default function TMAModal({ workspaceId, lot, onClose, onSuccess }: TMAModalProps) {
  const { t } = useI18n();
  /** This dialog's messages. */
  const td = (key: string, values?: Record<string, string | number>) =>
    t(`developerProjectDialogs.${key}` as MessageKey, values);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState('finishes');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [costEstimate, setCostEstimate] = useState<number>(0);
  const [priceQuote, setPriceQuote] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError(td('tmaRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/developer/tma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          lotId: lot.id,
          category,
          title: title.trim(),
          description: description.trim(),
          costEstimate: Number(costEstimate) || 0,
          priceQuote: Number(priceQuote) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || td('tmaFailed'));
      }

      onSuccess(data.tma);
    } catch (err: any) {
      setError(err.message || td('tmaFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={td('tmaNewTitle', { unit: lot.lotNumber })} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="p-3 bg-surface-container-high rounded text-sm mb-4">
          <p className="font-semibold text-on-surface">{td('unitLine', { unit: lot.lotNumber })}</p>
          <p className="text-on-surface-variant text-xs mt-0.5">
            {lot.buyerLead
              ? td('tmaBuyer', { name: `${lot.buyerLead.firstName || ''} ${lot.buyerLead.lastName || ''}`.trim() })
              : lot.optionHolderLead
              ? td('tmaHold', { name: lot.optionHolderLead.firstName || '' })
              : td('tmaNoBuyer')}
          </p>
        </div>

        <Field label={td('tmaCategory')}>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="electrical">{td('catElectrical')}</option>
            <option value="plumbing">{td('catPlumbing')}</option>
            <option value="partitions">{td('catPartitions')}</option>
            <option value="finishes">{td('catFinishes')}</option>
            <option value="other">{td('catOther')}</option>
          </select>
        </Field>

        <Field label={td('tmaSummary')} hint={td('tmaSummaryHint')}>
          <input
            type="text"
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={td('tmaSummaryPlaceholder')}
            required
          />
        </Field>

        <Field label={td('tmaDescription')}>
          <textarea
            className={`${inputClass} min-h-[90px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={td('tmaDescriptionPlaceholder')}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-surface-container-high">
          <Field label={td('tmaCost')} hint={td('tmaCostHint')}>
            <input
              type="number"
              className={inputClass}
              value={costEstimate}
              onChange={(e) => setCostEstimate(Number(e.target.value))}
            />
          </Field>

          <Field label={td('tmaQuote')} hint={td('tmaQuoteHint')}>
            <input
              type="number"
              className={inputClass}
              value={priceQuote}
              onChange={(e) => setPriceQuote(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? td('saving') : td('tmaSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

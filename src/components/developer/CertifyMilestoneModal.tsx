'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';

interface CertifyMilestoneModalProps {
  workspaceId: string;
  milestone: any;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export default function CertifyMilestoneModal({
  workspaceId,
  milestone,
  onClose,
  onSuccess,
}: CertifyMilestoneModalProps) {
  const { t } = useI18n();
  /** This dialog's messages. */
  const td = (key: string, values?: Record<string, string | number>) =>
    t(`developerProjectDialogs.${key}` as MessageKey, values);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [architectDoc, setArchitectDoc] = useState('');
  const [autoGenerateCalls, setAutoGenerateCalls] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/developer/milestones/${milestone.id}/certify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          architectCertificateDoc: architectDoc.trim() || undefined,
          autoGenerateCalls,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || td('certFailed'));
      }

      onSuccess(data);
    } catch (err: any) {
      setError(err.message || td('certFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={td('certTitle', { title: milestone.title })} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="p-3 bg-surface-container-high rounded text-sm mb-4 space-y-1">
          <p className="font-semibold text-on-surface">{milestone.title}</p>
          <p className="text-on-surface-variant">
            {td('certTarget', { percent: milestone.targetPercentage })}
          </p>
        </div>

        <Field label={td('certDoc')} hint={td('certDocHint')}>
          <input
            type="text"
            className={inputClass}
            value={architectDoc}
            onChange={(e) => setArchitectDoc(e.target.value)}
            placeholder={td('certDocPlaceholder')}
          />
        </Field>

        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
          <input
            type="checkbox"
            id="autoGenerate"
            checked={autoGenerateCalls}
            onChange={(e) => setAutoGenerateCalls(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-amber-300 text-primary focus:ring-primary"
          />
          <label htmlFor="autoGenerate" className="text-xs text-amber-900 leading-relaxed cursor-pointer">
            <strong>{td('certAutoTitle')}</strong>
            <br />
            {td('certAutoBody')}
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? td('certSaving') : td('certSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import { useWorkspaceCurrency } from '@/components/workspace/useWorkspaceCurrency';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';

interface OptionModalProps {
  workspaceId: string;
  lot: any;
  onClose: () => void;
  onSuccess: (updatedLot: any) => void;
}

export default function OptionModal({ workspaceId, lot, onClose, onSuccess }: OptionModalProps) {
  const { t } = useI18n();
  /** This dialog's messages. */
  const td = (key: string, values?: Record<string, string | number>) =>
    t(`developerProjectDialogs.${key}` as MessageKey, values);
  const currency = useWorkspaceCurrency(workspaceId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [durationHours, setDurationHours] = useState(48);

  useEffect(() => {
    // Fetch leads for this workspace
    fetch(`/api/leads?workspaceId=${workspaceId}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (data.leads) {
          setLeads(data.leads);
          if (data.leads.length > 0) {
            setSelectedLeadId(data.leads[0].id);
          }
        }
      })
      .catch((err) => console.error('Error fetching leads:', err));
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
      setError(td('optPickBuyer'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/developer/lots/${lot.id}/option`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          leadId: selectedLeadId,
          durationHours: Number(durationHours),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || td('optFailed'));
      }

      onSuccess(data.lot);
    } catch (err: any) {
      setError(err.message || td('optFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={td('optTitle', { unit: lot.lotNumber })} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="p-3 bg-surface-container-high rounded text-sm mb-4">
          <p className="font-semibold text-on-surface">{td('unitLine', { unit: lot.lotNumber })}</p>
          <p className="text-on-surface-variant">
            {lot.typology} · {lot.surfaceArea} m² ·{' '}
            {lot.totalPrice.toLocaleString(undefined, { style: 'currency', currency })}
          </p>
        </div>

        <Field label={td('optHolder')}>
          {leads.length > 0 ? (
            <select
              className={inputClass}
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              required
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.firstName} {l.lastName} {l.email ? `(${l.email})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-on-surface-variant italic">{td('loadingBuyers')}</p>
          )}
        </Field>

        <Field label={td('optDuration')}>
          <select
            className={inputClass}
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
          >
            <option value={24}>{td('h24')}</option>
            <option value={48}>{td('h48')}</option>
            <option value={72}>{td('h72')}</option>
            <option value={168}>{td('d7')}</option>
          </select>
        </Field>

        <p className="text-xs text-on-surface-variant">
          {td('optNote')}
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={primaryButton} disabled={loading || !selectedLeadId}>
            {loading ? td('saving') : td('optSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

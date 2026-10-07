'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import ContactPicker, { type PickedContact } from '@/components/realestate/ContactPicker';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';
import { useI18n } from '@/i18n/I18nProvider';

interface ReserveModalProps {
  workspaceId: string;
  lot: any;
  onClose: () => void;
  onSuccess: (updatedLot: any) => void;
}

/** Today as `YYYY-MM-DD` in the viewer's zone, for a date input. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ReserveModal({ workspaceId, lot, onClose, onSuccess }: ReserveModalProps) {
  const { t } = useI18n();
  const agents = useWorkspaceAgents(workspaceId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whoever holds the option is the natural buyer; otherwise the user searches.
  const holder = lot.optionHolderLead;
  const [buyer, setBuyer] = useState<PickedContact | null>(
    holder ? { id: holder.id, firstName: holder.firstName, lastName: holder.lastName, email: holder.email } : null
  );
  const [fee, setFee] = useState(lot.reservationFee ? String(lot.reservationFee) : '');
  const [received, setReceived] = useState(false);
  const [receivedOn, setReceivedOn] = useState(today());
  const [agentId, setAgentId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyer) {
      setError('Please select a buyer lead.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/developer/lots/${lot.id}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          buyerLeadId: buyer.id,
          salesAgentId: agentId || undefined,
          reservationFee: fee.trim() === '' ? null : Number(fee),
          // A fee that has not arrived has no date; the deposit can be marked received later.
          reservationFeePaidAt: fee.trim() !== '' && received ? receivedOn : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reserve lot');
      }

      onSuccess(data.lot);
    } catch (err: any) {
      setError(err.message || 'Error reserving lot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Formalize Reservation for Lot ${lot.lotNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="p-3 bg-surface-container-high rounded text-sm mb-4">
          <p className="font-semibold text-on-surface">Unit: Lot {lot.lotNumber}</p>
          <p className="text-on-surface-variant">
            {lot.typology} · {lot.surfaceArea} m² · Total:{' '}
            {lot.totalPrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>

        <Field label="Buyer Lead (Purchaser) *">
          <ContactPicker
            workspaceId={workspaceId}
            value={buyer}
            onChange={setBuyer}
            placeholder={t('developerSales.reserve.searchBuyer')}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('developerSales.reserve.fee')}>
            <input
              type="number"
              min={0}
              step={100}
              className={inputClass}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label={t('developerSales.reserve.agent')}>
            <select className={inputClass} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">{t('developerSales.reserve.agentMe')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {fee.trim() !== '' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-on-surface cursor-pointer">
              <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} />
              {t('developerSales.reserve.feeReceived')}
            </label>
            {received && (
              <input
                type="date"
                max={today()}
                className={`${inputClass} !w-auto`}
                value={receivedOn}
                onChange={(e) => setReceivedOn(e.target.value)}
                aria-label={t('developerSales.reserve.feeReceivedOn')}
              />
            )}
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded space-y-1">
          <p className="font-semibold">What happens upon reservation:</p>
          <p>• The unit status transitions permanently to <strong>Reserved</strong>.</p>
          <p>• The reservation deposit and cooling-off timeline begin.</p>
          <p>• This lot will be included in subsequent statutory construction milestone calls for funds.</p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={loading || !buyer}>
            {loading ? 'Reserving...' : 'Confirm Reservation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

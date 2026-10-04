'use client';

import { useEffect, useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';

interface ReserveModalProps {
  workspaceId: string;
  lot: any;
  onClose: () => void;
  onSuccess: (updatedLot: any) => void;
}

export default function ReserveModal({ workspaceId, lot, onClose, onSuccess }: ReserveModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState(lot.optionHolderLeadId || '');

  useEffect(() => {
    fetch(`/api/leads?workspaceId=${workspaceId}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (data.leads) {
          setLeads(data.leads);
          if (!selectedLeadId && data.leads.length > 0) {
            setSelectedLeadId(data.leads[0].id);
          }
        }
      })
      .catch((err) => console.error('Error fetching leads:', err));
  }, [workspaceId, selectedLeadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
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
          buyerLeadId: selectedLeadId,
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
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
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
            <p className="text-sm text-on-surface-variant italic">Loading contacts...</p>
          )}
        </Field>

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
          <button type="submit" className={primaryButton} disabled={loading || !selectedLeadId}>
            {loading ? 'Reserving...' : 'Confirm Reservation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';

interface OptionModalProps {
  workspaceId: string;
  lot: any;
  onClose: () => void;
  onSuccess: (updatedLot: any) => void;
}

export default function OptionModal({ workspaceId, lot, onClose, onSuccess }: OptionModalProps) {
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
      setError('Please select a lead/contact.');
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
        throw new Error(data.error || 'Failed to place option');
      }

      onSuccess(data.lot);
    } catch (err: any) {
      setError(err.message || 'Error placing option');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Put Lot ${lot.lotNumber} on Option (Hold)`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="p-3 bg-surface-container-high rounded text-sm mb-4">
          <p className="font-semibold text-on-surface">Unit: Lot {lot.lotNumber}</p>
          <p className="text-on-surface-variant">
            {lot.typology} · {lot.surfaceArea} m² ·{' '}
            {lot.totalPrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>

        <Field label="Option Holder (Lead / Prospect) *">
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
            <p className="text-sm text-on-surface-variant italic">Loading leads...</p>
          )}
        </Field>

        <Field label="Option Duration (Hold TTL)">
          <select
            className={inputClass}
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
          >
            <option value={24}>24 Hours</option>
            <option value={48}>48 Hours (Standard)</option>
            <option value={72}>72 Hours (Weekend hold)</option>
            <option value={168}>7 Days (Extended)</option>
          </select>
        </Field>

        <p className="text-xs text-on-surface-variant">
          Holding this lot prevents other agents from reserving or selling it until the countdown expires.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={loading || !selectedLeadId}>
            {loading ? 'Locking...' : 'Lock Temporary Option'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

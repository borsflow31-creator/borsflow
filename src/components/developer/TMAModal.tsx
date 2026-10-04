'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';

interface TMAModalProps {
  workspaceId: string;
  lot: any;
  onClose: () => void;
  onSuccess: (newTma: any) => void;
}

export default function TMAModal({ workspaceId, lot, onClose, onSuccess }: TMAModalProps) {
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
      setError('Title and description are required.');
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
        throw new Error(data.error || 'Failed to submit TMA request');
      }

      onSuccess(data.tma);
    } catch (err: any) {
      setError(err.message || 'Error submitting TMA request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`New Change Order (TMA) - Lot ${lot.lotNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="p-3 bg-surface-container-high rounded text-sm mb-4">
          <p className="font-semibold text-on-surface">Target Unit: Lot {lot.lotNumber}</p>
          <p className="text-on-surface-variant text-xs mt-0.5">
            Buyer:{' '}
            {lot.buyerLead
              ? `${lot.buyerLead.firstName || ''} ${lot.buyerLead.lastName || ''}`
              : lot.optionHolderLead
              ? `Hold: ${lot.optionHolderLead.firstName || ''}`
              : 'Unassigned'}
          </p>
        </div>

        <Field label="Modification Category *">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="electrical">Electrical (Additional sockets, switches, EV charging)</option>
            <option value="plumbing">Plumbing (Additional water inlet, shower upgrade, sink)</option>
            <option value="partitions">Partitions / Structural (Wall movement, pocket doors)</option>
            <option value="finishes">Finishes & Materials (Flooring upgrade, premium tiling)</option>
            <option value="other">Other Custom Work</option>
          </select>
        </Field>

        <Field label="Request Summary / Title *" hint="e.g. Add 2 extra power sockets in Living Room">
          <input
            type="text"
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Relocate kitchen water inlet"
            required
          />
        </Field>

        <Field label="Detailed Description & Specifications *">
          <textarea
            className={`${inputClass} min-h-[90px]`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe precise measurements, location on floor plans, and specific materials..."
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-surface-container-high">
          <Field label="Estimated Internal Cost (€)" hint="Subcontractor cost (HT)">
            <input
              type="number"
              className={inputClass}
              value={costEstimate}
              onChange={(e) => setCostEstimate(Number(e.target.value))}
            />
          </Field>

          <Field label="Sales Price Quote (€)" hint="Billed to purchaser (TTC)">
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
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit TMA Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

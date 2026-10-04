'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton, dangerButton } from '@/components/realestate/ui';

interface TMAReviewModalProps {
  workspaceId: string;
  tma: any;
  onClose: () => void;
  onSuccess: (updatedTma: any) => void;
}

export default function TMAReviewModal({
  workspaceId,
  tma,
  onClose,
  onSuccess,
}: TMAReviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [techNote, setTechNote] = useState(tma.techApproverNote || '');
  const [costEstimate, setCostEstimate] = useState<number>(tma.costEstimate || 0);
  const [priceQuote, setPriceQuote] = useState<number>(tma.priceQuote || 0);
  const [signedDoc, setSignedDoc] = useState(tma.signedAddendumDoc || '');

  const handleApprove = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/developer/tma/${tma.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          techApproverNote: techNote.trim() || undefined,
          costEstimate: Number(costEstimate),
          priceQuote: Number(priceQuote),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to review TMA');

      onSuccess(data.tma);
    } catch (err: any) {
      setError(err.message || 'Error reviewing TMA');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!confirm('Formally mark this TMA as signed/accepted? This will automatically increase the lot’s total price balance.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/developer/tma/${tma.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          signedAddendumDoc: signedDoc.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept TMA');

      onSuccess(data.tma);
    } catch (err: any) {
      setError(err.message || 'Error accepting TMA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Review Change Order: ${tma.reference}`} onClose={onClose} wide>
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        {/* TMA Summary Card */}
        <div className="p-4 bg-surface-container-high rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface text-on-surface">
              {tma.category.toUpperCase()}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">
              {tma.status.replace('_', ' ')}
            </span>
          </div>
          <h3 className="text-base font-bold text-on-surface">{tma.title}</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">{tma.description}</p>
        </div>

        {/* Technical Review Fields */}
        <Field label="Technical Feasibility Review & Notes (*Conducteur de Travaux*)">
          <textarea
            className={`${inputClass} min-h-[70px]`}
            value={techNote}
            onChange={(e) => setTechNote(e.target.value)}
            placeholder="Validate whether site stage allows modification, structural impacts, duct paths..."
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Trade Contractor Execution Cost (€ HT)">
            <input
              type="number"
              className={inputClass}
              value={costEstimate}
              onChange={(e) => setCostEstimate(Number(e.target.value))}
            />
          </Field>

          <Field label="Client Billed Price Quote (€ TTC)">
            <input
              type="number"
              className={inputClass}
              value={priceQuote}
              onChange={(e) => setPriceQuote(Number(e.target.value))}
            />
          </Field>
        </div>

        {tma.status !== 'accepted' && (
          <Field label="Signed Addendum Document Reference (*Avenant TMA*)">
            <input
              type="text"
              className={inputClass}
              value={signedDoc}
              onChange={(e) => setSignedDoc(e.target.value)}
              placeholder="e.g. Avenant_TMA_Signe_LotA302.pdf or signature ID"
            />
          </Field>
        )}

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            Close
          </button>

          <div className="flex items-center gap-2">
            {tma.status !== 'accepted' && (
              <button
                type="button"
                onClick={handleApprove}
                className={`${secondaryButton} text-xs py-2`}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Validate Feasibility & Quote'}
              </button>
            )}

            {tma.status !== 'accepted' && (
              <button
                type="button"
                onClick={handleAccept}
                className={`${primaryButton} text-xs py-2`}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Formalize & Sign Addendum'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

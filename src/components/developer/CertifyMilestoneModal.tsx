'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';

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
        throw new Error(data.error || 'Failed to certify milestone');
      }

      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Error certifying milestone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Certify Milestone: ${milestone.title}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="p-3 bg-surface-container-high rounded text-sm mb-4 space-y-1">
          <p className="font-semibold text-on-surface">{milestone.title}</p>
          <p className="text-on-surface-variant">
            Statutory Cumulative Target: <strong>{milestone.targetPercentage}%</strong>
          </p>
        </div>

        <Field label="Architect Certificate Reference / URL" hint="e.g. Attestation_Architecte_Fondations.pdf">
          <input
            type="text"
            className={inputClass}
            value={architectDoc}
            onChange={(e) => setArchitectDoc(e.target.value)}
            placeholder="https://... or certificate ID"
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
            <strong>Batch-generate Calls for Funds (*Appels de Fonds*) immediately:</strong>
            <br />
            Automatically creates legally compliant stage invoices for all active buyers in this development and recalculates remaining tranche balances.
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? 'Certifying...' : 'Certify & Issue Stage'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

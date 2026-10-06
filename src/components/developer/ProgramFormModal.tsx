'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import SelectRefined from '@/components/ui/SelectRefined';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { PROJECT_TYPES } from '@/lib/crm/projects';

interface ProgramFormModalProps {
  workspaceId: string;
  onClose: () => void;
  onSuccess: (program: any) => void;
}

export default function ProgramFormModal({ workspaceId, onClose, onSuccess }: ProgramFormModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [architectName, setArchitectName] = useState('');
  const [gfaBank, setGfaBank] = useState('');
  const [projectType, setProjectType] = useState('residential');
  const [developerName, setDeveloperName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !reference.trim() || !city.trim()) {
      setError('Name, reference, and city are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/developer/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          reference: reference.trim().toUpperCase(),
          name: name.trim(),
          commercialName: commercialName.trim() || undefined,
          city: city.trim(),
          postalCode: postalCode.trim() || undefined,
          addressLine: addressLine.trim() || undefined,
          targetDeliveryDate: targetDeliveryDate || undefined,
          permitNumber: permitNumber.trim() || undefined,
          architectName: architectName.trim() || undefined,
          projectType,
          developerName: developerName.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          gfaBank: gfaBank.trim() || undefined,
          status: 'study',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create program');
      }

      onSuccess(data.program);
    } catch (err: any) {
      setError(err.message || 'Error creating program');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Create Development Program" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Program Reference *" hint="e.g. PRG-PARC-2026">
            <input
              type="text"
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PRG-PARC-2026"
              required
            />
          </Field>

          <Field label="Legal Program Name *">
            <input
              type="text"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SCCV Les Jardins du Parc"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Commercial / Marketing Name">
            <input
              type="text"
              className={inputClass}
              value={commercialName}
              onChange={(e) => setCommercialName(e.target.value)}
              placeholder="e.g. Résidence Les Jardins du Parc"
            />
          </Field>

          <Field label="Target Delivery Quarter / Date">
            <input
              type="date"
              className={inputClass}
              value={targetDeliveryDate}
              onChange={(e) => setTargetDeliveryDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Project Type">
            <SelectRefined
              value={projectType}
              options={PROJECT_TYPES.map((v) => ({
                value: v,
                label: t(`realEstate.projects.type.${v}` as MessageKey),
              }))}
              onChange={setProjectType}
              variant="outlined"
            />
          </Field>

          <Field label="Developer / Promoter">
            <input
              type="text"
              className={inputClass}
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
              placeholder="e.g. Nexity"
            />
          </Field>

          <Field label="Project Website">
            <input
              type="url"
              className={inputClass}
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="City *">
            <input
              type="text"
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Bordeaux"
              required
            />
          </Field>

          <Field label="Postal Code">
            <input
              type="text"
              className={inputClass}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="33000"
            />
          </Field>

          <Field label="Street Address">
            <input
              type="text"
              className={inputClass}
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="12 Avenue des Fleurs"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-surface-container-high">
          <Field label="Building Permit #">
            <input
              type="text"
              className={inputClass}
              value={permitNumber}
              onChange={(e) => setPermitNumber(e.target.value)}
              placeholder="PC 033 063 26 A 0142"
            />
          </Field>

          <Field label="Architect / Project Manager">
            <input
              type="text"
              className={inputClass}
              value={architectName}
              onChange={(e) => setArchitectName(e.target.value)}
              placeholder="Cabinet Atelier Arch."
            />
          </Field>

          <Field label="GFA Bank Guarantee">
            <input
              type="text"
              className={inputClass}
              value={gfaBank}
              onChange={(e) => setGfaBank(e.target.value)}
              placeholder="Crédit Agricole CIB"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? 'Creating...' : 'Create Program'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

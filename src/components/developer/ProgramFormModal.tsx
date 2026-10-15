'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import SelectRefined from '@/components/ui/SelectRefined';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { PROJECT_TYPES } from '@/lib/crm/projects';
import { cachedJson } from '@/lib/client-cache';

interface ProgramFormModalProps {
  workspaceId: string;
  onClose: () => void;
  onSuccess: (program: any) => void;
}

export default function ProgramFormModal({ workspaceId, onClose, onSuccess }: ProgramFormModalProps) {
  const { t } = useI18n();
  /** This form's own messages. */
  const tl = useCallback((key: string) => t(`developerProjectList.${key}` as MessageKey), [t]);
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
  const [launchDate, setLaunchDate] = useState('');
  const [salesTargetUnits, setSalesTargetUnits] = useState('');
  const [revenueTarget, setRevenueTarget] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('');

  // The developer is usually the account itself, so start from the workspace's
  // name; it stays editable for a co-development. Reads the request the app
  // shell has already cached, and never overwrites what the user typed.
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    cachedJson<{ workspace?: { name?: string } }>(`/api/workspaces/${workspaceId}`)
      .then((data) => {
        const workspaceName = data.workspace?.name;
        if (!cancelled && workspaceName) setDeveloperName((current) => current || workspaceName);
      })
      .catch(() => { /* leave the field empty */ });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !reference.trim() || !city.trim()) {
      setError(tl('formRequired'));
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
          launchDate: launchDate || undefined,
          salesTargetUnits: salesTargetUnits.trim() ? Number(salesTargetUnits) : undefined,
          revenueTarget: revenueTarget.trim() ? Number(revenueTarget) : undefined,
          commissionPercent: commissionPercent.trim() ? Number(commissionPercent) : undefined,
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
        throw new Error(data.error || tl('formFailed'));
      }

      onSuccess(data.program);
    } catch (err: any) {
      setError(err.message || tl('formFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={tl('formTitle')} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={tl('formReference')} hint={tl('formReferenceHint')}>
            <input
              type="text"
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PRG-PARC-2026"
              required
            />
          </Field>

          <Field label={tl('formLegalName')}>
            <input
              type="text"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tl('formLegalNamePlaceholder')}
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={tl('formCommercialName')}>
            <input
              type="text"
              className={inputClass}
              value={commercialName}
              onChange={(e) => setCommercialName(e.target.value)}
              placeholder={tl('formCommercialNamePlaceholder')}
            />
          </Field>

          <Field label={tl('formDelivery')}>
            <input
              type="date"
              className={inputClass}
              value={targetDeliveryDate}
              onChange={(e) => setTargetDeliveryDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t('developer.launchDate')}>
            <input
              type="date"
              className={inputClass}
              value={launchDate}
              onChange={(e) => setLaunchDate(e.target.value)}
            />
          </Field>

          <Field label={t('developer.salesTargetUnits')}>
            <input
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={salesTargetUnits}
              onChange={(e) => setSalesTargetUnits(e.target.value)}
              placeholder="120"
            />
          </Field>

          <Field label={t('developer.revenueTarget')}>
            <input
              type="number"
              min={0}
              step={1000}
              className={inputClass}
              value={revenueTarget}
              onChange={(e) => setRevenueTarget(e.target.value)}
              placeholder="25000000"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t('developerSales.project.commission')} hint={t('developerSales.project.commissionHint')}>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className={inputClass}
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
              placeholder="3"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={tl('formType')}>
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

          <Field label={tl('formDeveloper')}>
            <input
              type="text"
              className={inputClass}
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
            />
          </Field>

          <Field label={tl('formWebsite')}>
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
          <Field label={tl('formCity')}>
            <input
              type="text"
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={tl('formCityPlaceholder')}
              required
            />
          </Field>

          <Field label={tl('formPostalCode')}>
            <input
              type="text"
              className={inputClass}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="33000"
            />
          </Field>

          <Field label={tl('formAddress')}>
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
          <Field label={tl('formPermit')}>
            <input
              type="text"
              className={inputClass}
              value={permitNumber}
              onChange={(e) => setPermitNumber(e.target.value)}
              placeholder="PC 033 063 26 A 0142"
            />
          </Field>

          <Field label={tl('formArchitect')}>
            <input
              type="text"
              className={inputClass}
              value={architectName}
              onChange={(e) => setArchitectName(e.target.value)}
              placeholder="Cabinet Atelier Arch."
            />
          </Field>

          <Field label={tl('formGuarantee')}>
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
            {tl('formCancel')}
          </button>
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? tl('formSubmitting') : tl('formSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

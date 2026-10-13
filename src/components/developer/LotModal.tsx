'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { useWorkspaceAgents } from '@/components/developer/useWorkspaceAgents';
import { useWorkspaceCurrency } from '@/components/workspace/useWorkspaceCurrency';

interface LotModalProps {
  workspaceId: string;
  programId: string;
  buildings?: { id: string; name: string }[];
  initialLot?: any;
  onClose: () => void;
  onSuccess: (lot: any) => void;
}

const ORIENTATIONS = ['S', 'SW', 'SE', 'W', 'E', 'N', 'NW', 'NE'];

export default function LotModal({
  workspaceId,
  programId,
  buildings = [],
  initialLot,
  onClose,
  onSuccess,
}: LotModalProps) {
  const { t, formatDate } = useI18n();
  /** This dialog's messages. */
  const td = (key: string, values?: Record<string, string | number>) =>
    t(`developerProjectDialogs.${key}` as MessageKey, values);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agents = useWorkspaceAgents(workspaceId);
  const currency = useWorkspaceCurrency(workspaceId);

  const [lotNumber, setLotNumber] = useState(initialLot?.lotNumber || '');
  const [buildingId, setBuildingId] = useState(initialLot?.buildingId || (buildings[0]?.id || ''));
  const [type, setType] = useState(initialLot?.type || 'apartment');
  const [typology, setTypology] = useState(initialLot?.typology || 'T3');
  const [floor, setFloor] = useState<number>(initialLot?.floor !== undefined ? initialLot.floor : 1);
  const [orientation, setOrientation] = useState(initialLot?.orientation || 'S');
  const [surfaceArea, setSurfaceArea] = useState<number>(initialLot?.surfaceArea || 65);
  const [terraceArea, setTerraceArea] = useState<number>(initialLot?.terraceArea || 0);
  const [balconyArea, setBalconyArea] = useState<number>(initialLot?.balconyArea || 0);
  const [gardenArea, setGardenArea] = useState<number>(initialLot?.gardenArea || 0);
  const [basePrice, setBasePrice] = useState<number>(initialLot?.basePrice || 220000);
  const [taxRate, setTaxRate] = useState<number>(initialLot?.taxRate !== undefined ? initialLot.taxRate : 20.0);

  const [bedrooms, setBedrooms] = useState<string>(
    initialLot?.bedrooms !== undefined && initialLot?.bedrooms !== null ? String(initialLot.bedrooms) : ''
  );
  const [discount, setDiscount] = useState<number>(initialLot?.discount || 0);
  const [salesAgentId, setSalesAgentId] = useState<string>(initialLot?.salesAgentId || '');

  // Mirrors the server: the discount comes off before tax.
  const computedTotal = Number((Math.max(0, basePrice - discount) * (1 + taxRate / 100)).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotNumber.trim() || basePrice <= 0) {
      setError(td('lotRequired'));
      return;
    }
    if (discount < 0 || discount > basePrice) {
      setError(td('lotDiscountRange'));
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      workspaceId,
      programId,
      buildingId: buildingId || undefined,
      lotNumber: lotNumber.trim(),
      type,
      typology: type === 'apartment' || type === 'house' ? typology : undefined,
      floor: Number(floor),
      orientation: orientation || undefined,
      surfaceArea: Number(surfaceArea),
      terraceArea: Number(terraceArea),
      balconyArea: Number(balconyArea),
      gardenArea: Number(gardenArea),
      basePrice: Number(basePrice),
      discount: Number(discount),
      taxRate: Number(taxRate),
      bedrooms: bedrooms.trim() === '' ? (initialLot ? null : undefined) : Number(bedrooms),
      // An empty choice clears the agent on edit, and is left unset on create.
      salesAgentId: salesAgentId || (initialLot ? null : undefined),
    };

    try {
      const url = initialLot
        ? `/api/developer/lots/${initialLot.id}`
        : `/api/developer/programs/${programId}/lots`;
      const method = initialLot ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || td('lotFailed'));
      }

      onSuccess(data.lot);
    } catch (err: any) {
      setError(err.message || td('lotFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={initialLot ? td('lotEditTitle', { unit: initialLot.lotNumber }) : td('lotNewTitle')} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={td('lotNumber')} hint={td('lotNumberHint')}>
            <input
              type="text"
              className={inputClass}
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="A201"
              required
            />
          </Field>

          {buildings.length > 0 && (
            <Field label={td('building')}>
              <select
                className={inputClass}
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
              >
                <option value="">{td('noBuilding')}</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label={td('type')}>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="apartment">{td('typeApartment')}</option>
              <option value="house">{td('typeHouse')}</option>
              <option value="parking">{td('typeParking')}</option>
              <option value="box">{td('typeBox')}</option>
              <option value="cellar">{td('typeCellar')}</option>
              <option value="commercial">{td('typeCommercial')}</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(type === 'apartment' || type === 'house') && (
            <Field label={td('typology')}>
              <select
                className={inputClass}
                value={typology}
                onChange={(e) => setTypology(e.target.value)}
              >
                <option value="studio">{td('typStudio')}</option>
                <option value="T1">{td('typT1')}</option>
                <option value="T2">{td('typT2')}</option>
                <option value="T3">{td('typT3')}</option>
                <option value="T4">{td('typT4')}</option>
                <option value="T5">{td('typT5')}</option>
                <option value="duplex">{td('typDuplex')}</option>
              </select>
            </Field>
          )}

          <Field label={td('floorLevel')}>
            <input
              type="number"
              className={inputClass}
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              placeholder={td('floorPlaceholder')}
            />
          </Field>

          <Field label={td('orientation')}>
            <select
              className={inputClass}
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
            >
              {/* A value typed elsewhere (an import, "Nord") stays as it is rather than
                  silently showing, then saving, the first option. */}
              {orientation && !ORIENTATIONS.includes(orientation) && <option value={orientation}>{orientation}</option>}
              {ORIENTATIONS.map((code) => (
                <option key={code} value={code}>{td(`ori${code}`)}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-surface-container-high">
          <Field label={td('surface')}>
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={surfaceArea}
              onChange={(e) => setSurfaceArea(Number(e.target.value))}
            />
          </Field>

          <Field label={td('terrace')}>
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={terraceArea}
              onChange={(e) => setTerraceArea(Number(e.target.value))}
            />
          </Field>

          <Field label={td('balcony')}>
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={balconyArea}
              onChange={(e) => setBalconyArea(Number(e.target.value))}
            />
          </Field>

          <Field label={td('garden')}>
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={gardenArea}
              onChange={(e) => setGardenArea(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t('developer.bedrooms')}>
            <input
              type="number"
              min={0}
              max={50}
              step={1}
              className={inputClass}
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
            />
          </Field>

          <Field label={t('developer.discount')}>
            <input
              type="number"
              min={0}
              step={100}
              className={inputClass}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </Field>

          <Field label={t('developer.salesAgent')}>
            <select
              className={inputClass}
              value={salesAgentId}
              onChange={(e) => setSalesAgentId(e.target.value)}
            >
              <option value="">{t('developer.noAgent')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {initialLot && (initialLot.reservedAt || initialLot.contractSignedAt) && (
          <p className="text-xs text-on-surface-variant">
            {initialLot.reservedAt && (
              <span>{t('developer.reservedOn')} {formatDate(initialLot.reservedAt)}</span>
            )}
            {initialLot.reservedAt && initialLot.contractSignedAt && ' · '}
            {initialLot.contractSignedAt && (
              <span>{t('developer.contractSignedOn')} {formatDate(initialLot.contractSignedAt)}</span>
            )}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-surface-container-high">
          <Field label={td('basePrice')}>
            <input
              type="number"
              className={inputClass}
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              required
            />
          </Field>

          {/* Any rate: 19 % or 9 % in Algeria, 20 %, 10 % or 5.5 % in France... */}
          <Field label={td('vatRate')}>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className={inputClass}
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              required
            />
          </Field>

          <div className="bg-surface-container-high p-3 rounded flex flex-col justify-center">
            <span className="text-xs text-on-surface-variant font-medium">{td('total')}</span>
            <span className="text-lg font-bold text-primary">
              {computedTotal.toLocaleString(undefined, { style: 'currency', currency })}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? td('saving') : initialLot ? td('lotSubmitEdit') : td('lotSubmitNew')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

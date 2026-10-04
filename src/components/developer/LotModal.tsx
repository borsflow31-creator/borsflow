'use client';

import { useState } from 'react';
import { Modal, Field, inputClass, primaryButton, secondaryButton } from '@/components/realestate/ui';

interface LotModalProps {
  workspaceId: string;
  programId: string;
  buildings?: { id: string; name: string }[];
  initialLot?: any;
  onClose: () => void;
  onSuccess: (lot: any) => void;
}

export default function LotModal({
  workspaceId,
  programId,
  buildings = [],
  initialLot,
  onClose,
  onSuccess,
}: LotModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const computedTotal = Number((basePrice * (1 + taxRate / 100)).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotNumber.trim() || basePrice <= 0) {
      setError('Lot number and base price are required.');
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
      taxRate: Number(taxRate),
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
        throw new Error(data.error || 'Failed to save lot');
      }

      onSuccess(data.lot);
    } catch (err: any) {
      setError(err.message || 'Error saving lot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={initialLot ? `Edit Lot ${initialLot.lotNumber}` : 'Add New Lot / Unit'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Lot Number *" hint="e.g. A201, PK-12">
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
            <Field label="Building / Phase">
              <select
                className={inputClass}
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Type">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="apartment">Apartment</option>
              <option value="house">House / Villa</option>
              <option value="parking">Parking Bay</option>
              <option value="box">Garage / Box</option>
              <option value="cellar">Cellar (Cave)</option>
              <option value="commercial">Commercial Space</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(type === 'apartment' || type === 'house') && (
            <Field label="Typology">
              <select
                className={inputClass}
                value={typology}
                onChange={(e) => setTypology(e.target.value)}
              >
                <option value="studio">Studio</option>
                <option value="T1">T1 (1-room)</option>
                <option value="T2">T2 (1-bed)</option>
                <option value="T3">T3 (2-bed)</option>
                <option value="T4">T4 (3-bed)</option>
                <option value="T5">T5 (4-bed+)</option>
                <option value="duplex">Duplex</option>
              </select>
            </Field>
          )}

          <Field label="Floor Level">
            <input
              type="number"
              className={inputClass}
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              placeholder="0 (Ground Floor)"
            />
          </Field>

          <Field label="Orientation">
            <select
              className={inputClass}
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
            >
              <option value="S">South</option>
              <option value="SW">South-West</option>
              <option value="SE">South-East</option>
              <option value="W">West</option>
              <option value="E">East</option>
              <option value="N">North</option>
              <option value="NW">North-West</option>
              <option value="NE">North-East</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-surface-container-high">
          <Field label="Habitable Surface (m²)">
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={surfaceArea}
              onChange={(e) => setSurfaceArea(Number(e.target.value))}
            />
          </Field>

          <Field label="Terrace (m²)">
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={terraceArea}
              onChange={(e) => setTerraceArea(Number(e.target.value))}
            />
          </Field>

          <Field label="Balcony (m²)">
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={balconyArea}
              onChange={(e) => setBalconyArea(Number(e.target.value))}
            />
          </Field>

          <Field label="Private Garden (m²)">
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={gardenArea}
              onChange={(e) => setGardenArea(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-surface-container-high">
          <Field label="Base Price (€ HT / Pre-Tax) *">
            <input
              type="number"
              className={inputClass}
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              required
            />
          </Field>

          <Field label="VAT Rate (%)">
            <select
              className={inputClass}
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
            >
              <option value={20.0}>Standard (20.0%)</option>
              <option value={5.5}>Reduced ANRU (5.5%)</option>
              <option value={10.0}>Intermediate (10.0%)</option>
              <option value={0.0}>Zero Tax (0.0%)</option>
            </select>
          </Field>

          <div className="bg-surface-container-high p-3 rounded flex flex-col justify-center">
            <span className="text-xs text-on-surface-variant font-medium">Total Incl. VAT</span>
            <span className="text-lg font-bold text-primary">
              {computedTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-container-high">
          <button type="button" onClick={onClose} className={secondaryButton} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={loading}>
            {loading ? 'Saving...' : initialLot ? 'Update Lot' : 'Create Lot'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

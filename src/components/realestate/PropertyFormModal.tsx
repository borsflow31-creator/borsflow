'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import SelectRefined from '@/components/ui/SelectRefined';
import ContactPicker, { type PickedContact } from './ContactPicker';
import { Field, Modal, SectionTitle, errorFrom, inputClass, primaryButton, secondaryButton, useWorkspaceInfo } from './ui';
import { ENERGY_RATINGS, PROPERTY_STATUSES, PROPERTY_TYPES, TRANSACTION_TYPES } from '@/lib/crm/lifecycle';

export interface PropertyRecord {
    id: string;
    reference: string;
    title: string;
    description?: string | null;
    propertyType: string;
    transactionType: string;
    status: string;
    stage: string;
    price: number;
    currency?: string | null;
    addressLine?: string | null;
    isAddressPublic: boolean;
    city: string;
    district?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    surfaceArea?: number | null;
    landArea?: number | null;
    rooms?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    floor?: number | null;
    buildYear?: number | null;
    energyRating?: string | null;
    hasElevator: boolean;
    hasParking: boolean;
    hasBalcony: boolean;
    hasTerrace: boolean;
    hasGarden: boolean;
    hasPool: boolean;
    furnished: boolean;
    customFields?: Record<string, string | number | boolean>;
    vendorId?: string | null;
    vendor?: PickedContact | null;
    ownerId?: string | null;
    listedAt?: string | null;
    pipelineId?: string | null;
    isPublished?: boolean;
    publicToken?: string | null;
}

interface CustomFieldDef {
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'date';
}

const AMENITIES = [
    ['hasElevator', 'elevator'],
    ['hasParking', 'parking'],
    ['hasBalcony', 'balcony'],
    ['hasTerrace', 'terrace'],
    ['hasGarden', 'garden'],
    ['hasPool', 'pool'],
    ['furnished', 'furnished'],
] as const;

/** A numeric/text column as the form holds it: always a string, '' meaning empty. */
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export default function PropertyFormModal({
    workspaceId,
    property,
    onSaved,
    onClose,
}: {
    workspaceId: string;
    property?: PropertyRecord | null;
    onSaved: (property: PropertyRecord) => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const info = useWorkspaceInfo(workspaceId);
    const editing = Boolean(property);

    const [form, setForm] = useState(() => ({
        reference: s(property?.reference),
        title: s(property?.title),
        description: s(property?.description),
        propertyType: property?.propertyType ?? 'apartment',
        transactionType: property?.transactionType ?? 'sale',
        status: property?.status ?? 'prospect',
        price: s(property?.price || ''),
        currency: s(property?.currency),
        addressLine: s(property?.addressLine),
        isAddressPublic: property?.isAddressPublic ?? false,
        city: s(property?.city),
        district: s(property?.district),
        postalCode: s(property?.postalCode),
        countryCode: s(property?.countryCode),
        latitude: s(property?.latitude),
        longitude: s(property?.longitude),
        surfaceArea: s(property?.surfaceArea),
        landArea: s(property?.landArea),
        rooms: s(property?.rooms),
        bedrooms: s(property?.bedrooms),
        bathrooms: s(property?.bathrooms),
        floor: s(property?.floor),
        buildYear: s(property?.buildYear),
        energyRating: s(property?.energyRating),
        hasElevator: property?.hasElevator ?? false,
        hasParking: property?.hasParking ?? false,
        hasBalcony: property?.hasBalcony ?? false,
        hasTerrace: property?.hasTerrace ?? false,
        hasGarden: property?.hasGarden ?? false,
        hasPool: property?.hasPool ?? false,
        furnished: property?.furnished ?? false,
        ownerId: property?.ownerId ?? '',
    }));
    const [vendor, setVendor] = useState<PickedContact | null>(property?.vendor ?? null);
    const [custom, setCustom] = useState<Record<string, string | number | boolean>>(property?.customFields ?? {});
    const [defs, setDefs] = useState<CustomFieldDef[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }));

    useEffect(() => {
        fetch(`/api/products/custom-fields?workspaceId=${workspaceId}&entityType=property`)
            .then(res => (res.ok ? res.json() : { fields: [] }))
            .then(data => setDefs(data.fields ?? []))
            .catch(() => {});
    }, [workspaceId]);

    const typeOptions = useMemo(
        () => PROPERTY_TYPES.map(v => ({ value: v, label: t(`realEstate.properties.types.${v}` as MessageKey) })),
        [t]
    );
    const statusOptions = useMemo(
        () => PROPERTY_STATUSES.map(v => ({ value: v, label: t(`realEstate.properties.status.${v}` as MessageKey) })),
        [t]
    );
    const transactionOptions = useMemo(
        () => TRANSACTION_TYPES.map(v => ({ value: v, label: t(`realEstate.properties.transaction.${v}` as MessageKey) })),
        [t]
    );
    const energyOptions = useMemo(
        () => [{ value: '', label: t('realEstate.properties.form.energyNone') }, ...ENERGY_RATINGS.map(v => ({ value: v, label: v }))],
        [t]
    );
    const agentOptions = useMemo(
        () => [{ value: '', label: t('realEstate.properties.form.ownerNone') }, ...info.agents.map(a => ({ value: a.id, label: a.name }))],
        [info.agents, t]
    );

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim() || !form.city.trim()) {
            setError(t('realEstate.properties.form.required'));
            return;
        }
        setSaving(true);
        setError('');

        // '' means "clear this column" on an edit and "not given" on a create; the
        // server reads null as the first and treats an absent key as the second, so
        // blanks are sent as null either way.
        const blank = (v: string) => (v.trim() === '' ? null : v.trim());
        const body = {
            workspaceId,
            reference: blank(form.reference) ?? undefined,
            title: form.title,
            description: blank(form.description),
            propertyType: form.propertyType,
            transactionType: form.transactionType,
            status: form.status,
            price: blank(form.price) ?? 0,
            currency: blank(form.currency),
            addressLine: blank(form.addressLine),
            isAddressPublic: form.isAddressPublic,
            city: form.city,
            district: blank(form.district),
            postalCode: blank(form.postalCode),
            countryCode: blank(form.countryCode),
            latitude: blank(form.latitude),
            longitude: blank(form.longitude),
            surfaceArea: blank(form.surfaceArea),
            landArea: blank(form.landArea),
            rooms: blank(form.rooms),
            bedrooms: blank(form.bedrooms),
            bathrooms: blank(form.bathrooms),
            floor: blank(form.floor),
            buildYear: blank(form.buildYear),
            energyRating: blank(form.energyRating),
            hasElevator: form.hasElevator,
            hasParking: form.hasParking,
            hasBalcony: form.hasBalcony,
            hasTerrace: form.hasTerrace,
            hasGarden: form.hasGarden,
            hasPool: form.hasPool,
            furnished: form.furnished,
            vendorId: vendor?.id ?? null,
            ownerId: form.ownerId || null,
            customFields: custom,
        };

        try {
            const res = await fetch(editing ? `/api/properties/${property!.id}` : '/api/properties', {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                setError(await errorFrom(res, t('realEstate.properties.errors.save')));
                return;
            }
            const data = await res.json();
            onSaved(data.property);
        } catch {
            setError(t('realEstate.properties.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    const text = (key: keyof typeof form, label: string, extra: { type?: string; placeholder?: string; required?: boolean } = {}) => (
        <Field label={label}>
            <input
                type={extra.type ?? 'text'}
                value={form[key] as string}
                onChange={e => set(key, e.target.value as any)}
                className={inputClass}
                placeholder={extra.placeholder}
                required={extra.required}
                step={extra.type === 'number' ? 'any' : undefined}
            />
        </Field>
    );

    return (
        <Modal title={editing ? t('realEstate.properties.edit') : t('realEstate.properties.new')} onClose={onClose} wide>
            <form onSubmit={submit} className="space-y-8">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}

                <section className="space-y-4">
                    <SectionTitle>{t('realEstate.properties.form.sectionBasics')}</SectionTitle>
                    {text('title', t('realEstate.properties.form.title'), { required: true })}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label={t('realEstate.properties.form.type')}>
                            <SelectRefined value={form.propertyType} options={typeOptions} onChange={v => set('propertyType', v)} variant="filled" />
                        </Field>
                        <Field label={t('realEstate.properties.form.transaction')}>
                            <SelectRefined value={form.transactionType} options={transactionOptions} onChange={v => set('transactionType', v)} variant="filled" />
                        </Field>
                        <Field label={t('realEstate.properties.form.status')}>
                            <SelectRefined value={form.status} options={statusOptions} onChange={v => set('status', v)} variant="filled" />
                        </Field>
                        {text('reference', t('realEstate.properties.form.reference'), { placeholder: t('realEstate.properties.form.referencePlaceholder') })}
                        {text('price', t('realEstate.properties.form.price'), { type: 'number' })}
                        {text('currency', t('realEstate.properties.form.currency'), { placeholder: info.currency })}
                    </div>
                    <Field label={t('realEstate.properties.form.description')}>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} className={`${inputClass} resize-none`} />
                    </Field>
                </section>

                <section className="space-y-4">
                    <SectionTitle>{t('realEstate.properties.form.sectionAddress')}</SectionTitle>
                    {text('addressLine', t('realEstate.properties.form.addressLine'))}
                    <label className="flex items-center gap-2 body-sm text-on-surface">
                        <input type="checkbox" checked={form.isAddressPublic} onChange={e => set('isAddressPublic', e.target.checked)} />
                        {t('realEstate.properties.form.addressPublic')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {text('city', t('realEstate.properties.form.city'), { required: true })}
                        {text('district', t('realEstate.properties.form.district'))}
                        {text('postalCode', t('realEstate.properties.form.postalCode'))}
                        {text('countryCode', t('realEstate.properties.form.country'), { placeholder: 'PT' })}
                        {text('latitude', t('realEstate.properties.form.latitude'), { type: 'number' })}
                        {text('longitude', t('realEstate.properties.form.longitude'), { type: 'number' })}
                    </div>
                </section>

                <section className="space-y-4">
                    <SectionTitle>{t('realEstate.properties.form.sectionDetails')}</SectionTitle>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {text('surfaceArea', t('realEstate.properties.form.surface'), { type: 'number' })}
                        {text('landArea', t('realEstate.properties.form.landArea'), { type: 'number' })}
                        {text('rooms', t('realEstate.properties.form.rooms'), { type: 'number' })}
                        {text('bedrooms', t('realEstate.properties.form.bedrooms'), { type: 'number' })}
                        {text('bathrooms', t('realEstate.properties.form.bathrooms'), { type: 'number' })}
                        {text('floor', t('realEstate.properties.form.floor'), { type: 'number' })}
                        {text('buildYear', t('realEstate.properties.form.buildYear'), { type: 'number' })}
                        <Field label={t('realEstate.properties.form.energyRating')}>
                            <SelectRefined value={form.energyRating} options={energyOptions} onChange={v => set('energyRating', v)} variant="filled" />
                        </Field>
                    </div>
                </section>

                <section className="space-y-4">
                    <SectionTitle>{t('realEstate.properties.form.sectionAmenities')}</SectionTitle>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {AMENITIES.map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 body-sm text-on-surface">
                                <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} />
                                {t(`realEstate.properties.form.${label}` as MessageKey)}
                            </label>
                        ))}
                    </div>
                </section>

                <section className="space-y-4">
                    <SectionTitle>{t('realEstate.properties.form.sectionPeople')}</SectionTitle>
                    <Field label={t('realEstate.properties.form.vendor')}>
                        <ContactPicker workspaceId={workspaceId} value={vendor} onChange={setVendor} placeholder={t('realEstate.properties.form.vendorNone')} />
                    </Field>
                    <Field label={t('realEstate.properties.form.owner')}>
                        <SelectRefined value={form.ownerId} options={agentOptions} onChange={v => set('ownerId', v)} variant="filled" />
                    </Field>
                </section>

                {defs.length > 0 && (
                    <section className="space-y-4">
                        <SectionTitle>{t('realEstate.properties.form.customFields')}</SectionTitle>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {defs.map(def => (
                                <Field key={def.key} label={def.label}>
                                    {def.type === 'boolean' ? (
                                        <input
                                            type="checkbox"
                                            checked={custom[def.key] === true}
                                            onChange={e => setCustom(prev => ({ ...prev, [def.key]: e.target.checked }))}
                                        />
                                    ) : (
                                        <input
                                            type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
                                            step={def.type === 'number' ? 'any' : undefined}
                                            value={custom[def.key] === undefined ? '' : String(custom[def.key])}
                                            onChange={e => setCustom(prev => ({ ...prev, [def.key]: e.target.value }))}
                                            className={inputClass}
                                        />
                                    )}
                                </Field>
                            ))}
                        </div>
                    </section>
                )}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={primaryButton}>
                        {saving ? t('common.saving') : editing ? t('realEstate.properties.form.save') : t('realEstate.properties.form.create')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

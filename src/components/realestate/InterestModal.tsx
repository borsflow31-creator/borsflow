'use client';

import { useMemo, useState } from 'react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import SelectRefined from '@/components/ui/SelectRefined';
import ContactPicker, { type PickedContact } from './ContactPicker';
import PropertyPicker, { type PickedProperty } from './PropertyPicker';
import { Field, Modal, errorFrom, inputClass, primaryButton, secondaryButton, useWorkspaceInfo } from './ui';
import { INTEREST_SOURCES } from '@/lib/crm/lifecycle';

/**
 * Attach a buyer to a property. Either side can be fixed by the caller: the
 * property page fixes the property and asks for a buyer; a contact's page fixes
 * the buyer and asks for a property; the buyer board asks for both.
 */
export default function InterestModal({
    workspaceId,
    lead,
    property,
    onSaved,
    onClose,
}: {
    workspaceId: string;
    lead?: PickedContact | null;
    property?: PickedProperty | null;
    onSaved: () => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const info = useWorkspaceInfo(workspaceId);
    const [buyer, setBuyer] = useState<PickedContact | null>(lead ?? null);
    const [picked, setPicked] = useState<PickedProperty | null>(property ?? null);
    const [source, setSource] = useState('manual');
    const [ownerId, setOwnerId] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const sourceOptions = useMemo(
        () => INTEREST_SOURCES.map(v => ({ value: v, label: t(`realEstate.interests.source.${v}` as MessageKey) })),
        [t]
    );
    const agentOptions = useMemo(
        () => [{ value: '', label: t('realEstate.properties.form.ownerNone') }, ...info.agents.map(a => ({ value: a.id, label: a.name }))],
        [info.agents, t]
    );

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!buyer) return setError(t('realEstate.interests.form.buyerRequired'));
        if (!picked) return setError(t('realEstate.interests.form.propertyRequired'));
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/interests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceId,
                    leadId: buyer.id,
                    propertyId: picked.id,
                    source,
                    ownerId: ownerId || undefined,
                    notes: notes.trim() || undefined,
                }),
            });
            if (!res.ok) {
                setError(await errorFrom(res, t('realEstate.interests.errors.save')));
                return;
            }
            onSaved();
        } catch {
            setError(t('realEstate.interests.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={t('realEstate.interests.new')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <Field label={t('realEstate.interests.form.buyer')}>
                    <ContactPicker
                        workspaceId={workspaceId}
                        value={buyer}
                        onChange={setBuyer}
                        placeholder={t('realEstate.interests.form.buyerPlaceholder')}
                        allowClear={!lead}
                    />
                </Field>
                <Field label={t('realEstate.interests.form.property')}>
                    <PropertyPicker workspaceId={workspaceId} value={picked} onChange={setPicked} placeholder={t('realEstate.properties.searchPlaceholder')} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('realEstate.interests.form.source')}>
                        <SelectRefined value={source} options={sourceOptions} onChange={setSource} variant="filled" />
                    </Field>
                    <Field label={t('realEstate.interests.form.owner')}>
                        <SelectRefined value={ownerId} options={agentOptions} onChange={setOwnerId} variant="filled" />
                    </Field>
                </div>
                <Field label={t('realEstate.interests.form.notes')}>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
                </Field>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={primaryButton}>
                        {saving ? t('common.saving') : t('realEstate.interests.form.create')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import ContactPicker, { type PickedContact } from './ContactPicker';
import PropertyPicker, { type PickedProperty } from './PropertyPicker';
import { Field, Modal, errorFrom, inputClass, primaryButton, secondaryButton } from './ui';

/**
 * Log an enquiry that came by phone or in person. It posts to the same intake the
 * website form uses, so it is de-duplicated by address, attached to
 * the property named, and starts any new-contact automation.
 *
 * Most callers are already in the book. Picking them from the contact list files
 * the enquiry against that contact exactly, and spares the agent retyping a name
 * and an address they would have to get character-perfect for the de-duplication
 * by address to recognise them.
 */
export default function EnquiryModal({
    workspaceId,
    onDone,
    onClose,
}: {
    workspaceId: string;
    onDone: (message: string) => void;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', message: '' });
    const [contact, setContact] = useState<PickedContact | null>(null);
    const [property, setProperty] = useState<PickedProperty | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k: keyof typeof f, v: string) => setF(prev => ({ ...prev, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contact && !f.email.trim() && !f.phone.trim()) return setError(t('realEstate.intake.contactRequired'));
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/enquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // A picked contact is the identity; the typed fields are then empty
                // and would only give intake a second, blank name to match on.
                body: JSON.stringify(
                    contact
                        ? { workspaceId, leadId: contact.id, message: f.message, propertyId: property?.id }
                        : { workspaceId, ...f, propertyId: property?.id }
                ),
            });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.intake.errors.save')));
            const outcome = await res.json();
            onDone(
                outcome.suppressed ? t('realEstate.intake.suppressed')
                : outcome.created ? t('realEstate.intake.created')
                : t('realEstate.intake.existing')
            );
        } catch {
            setError(t('realEstate.intake.errors.save'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={t('realEstate.intake.title')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}
                <Field label={t('realEstate.intake.contact')}>
                    <ContactPicker
                        workspaceId={workspaceId}
                        value={contact}
                        onChange={setContact}
                        placeholder={t('realEstate.intake.contactSearchPlaceholder')}
                    />
                </Field>
                {/* The form for someone who is not in the book yet, out of the way
                    once a contact has been picked. */}
                {!contact && (
                    <fieldset>
                        <legend className="body-sm text-on-surface-variant mb-2">{t('realEstate.intake.orNewContact')}</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={t('realEstate.intake.firstName')}><input value={f.firstName} onChange={e => set('firstName', e.target.value)} className={inputClass} /></Field>
                            <Field label={t('realEstate.intake.lastName')}><input value={f.lastName} onChange={e => set('lastName', e.target.value)} className={inputClass} /></Field>
                            <Field label={t('realEstate.intake.email')}><input type="email" value={f.email} onChange={e => set('email', e.target.value)} className={inputClass} /></Field>
                            <Field label={t('realEstate.intake.phone')}><input type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} className={inputClass} /></Field>
                        </div>
                    </fieldset>
                )}
                <Field label={t('realEstate.intake.property')}>
                    <PropertyPicker workspaceId={workspaceId} value={property} onChange={setProperty} placeholder={t('realEstate.properties.searchPlaceholder')} />
                </Field>
                <Field label={t('realEstate.intake.message')}>
                    <textarea value={f.message} onChange={e => set('message', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
                </Field>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className={secondaryButton}>{t('common.cancel')}</button>
                    <button type="submit" disabled={saving} className={primaryButton}>{saving ? t('common.saving') : t('realEstate.intake.submit')}</button>
                </div>
            </form>
        </Modal>
    );
}

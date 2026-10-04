'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import PropertyPicker, { type PickedProperty } from './PropertyPicker';
import { Field, Modal, errorFrom, inputClass, primaryButton, secondaryButton } from './ui';

/**
 * Log an enquiry that came by phone or in person. It posts to the same intake the
 * website form and the portals use, so it is de-duplicated by address, attached to
 * the property named, and starts any new-contact automation.
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
    const [property, setProperty] = useState<PickedProperty | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k: keyof typeof f, v: string) => setF(prev => ({ ...prev, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!f.email.trim() && !f.phone.trim()) return setError(t('realEstate.intake.contactRequired'));
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/enquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId, ...f, propertyId: property?.id }),
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label={t('realEstate.intake.firstName')}><input value={f.firstName} onChange={e => set('firstName', e.target.value)} className={inputClass} /></Field>
                    <Field label={t('realEstate.intake.lastName')}><input value={f.lastName} onChange={e => set('lastName', e.target.value)} className={inputClass} /></Field>
                    <Field label={t('realEstate.intake.email')}><input type="email" value={f.email} onChange={e => set('email', e.target.value)} className={inputClass} /></Field>
                    <Field label={t('realEstate.intake.phone')}><input type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} className={inputClass} /></Field>
                </div>
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

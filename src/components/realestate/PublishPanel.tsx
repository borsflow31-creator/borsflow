'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Badge, SectionTitle, errorFrom, primaryButton, secondaryButton } from './ui';

/**
 * Publishing a listing: the public page, and the link to it.
 *
 * Publishing is what makes the link work and what puts the property in portal feeds;
 * an unpublished property's link resolves to nothing. Rotating the link is how an
 * agent retires one that has been shared too widely.
 */
export function PublishPanel({
    propertyId,
    isPublished,
    hasLink,
    canWrite,
    onChanged,
}: {
    propertyId: string;
    isPublished: boolean;
    hasLink: boolean;
    canWrite: boolean;
    onChanged: () => void;
}) {
    const { t } = useI18n();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const run = async (fn: () => Promise<Response>, after?: (res: Response) => Promise<void>) => {
        setBusy(true);
        setError('');
        try {
            const res = await fn();
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.properties.detail.publish.error')));
            if (after) await after(res);
            onChanged();
        } catch {
            setError(t('realEstate.properties.detail.publish.error'));
        } finally {
            setBusy(false);
        }
    };

    const post = (body: object) => () => fetch(`/api/properties/${propertyId}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    const copy = async (res: Response) => {
        const { url } = await res.json();
        try {
            await navigator.clipboard.writeText(url);
            alert(t('realEstate.properties.detail.publish.copied'));
        } catch {
            prompt(t('realEstate.properties.detail.publish.link'), url);
        }
    };

    const unpublish = () => fetch(`/api/properties/${propertyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublished: false }) });

    return (
        <section className="bg-surface-container rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <SectionTitle>{t('realEstate.properties.detail.publish.title')}</SectionTitle>
                <Badge tone={isPublished ? 'good' : 'neutral'}>{t(isPublished ? 'realEstate.properties.detail.publish.published' : 'realEstate.properties.detail.publish.draft')}</Badge>
            </div>
            <p className="body-sm text-on-surface-variant">{t('realEstate.properties.detail.publish.hint')}</p>
            {error && <p className="body-sm text-error" role="alert">{error}</p>}
            {canWrite && (
                <div className="flex flex-wrap gap-2">
                    {!isPublished && <button disabled={busy} onClick={() => run(post({ publish: true }), copy)} className={primaryButton}>{t('realEstate.properties.detail.publish.publish')}</button>}
                    {isPublished && <button disabled={busy} onClick={() => run(post({}), copy)} className={primaryButton}>{t('realEstate.properties.detail.publish.copyLink')}</button>}
                    {isPublished && <button disabled={busy} onClick={() => run(unpublish)} className={secondaryButton}>{t('realEstate.properties.detail.publish.unpublish')}</button>}
                    {hasLink && (
                        <button
                            disabled={busy}
                            onClick={() => { if (confirm(t('realEstate.properties.detail.publish.rotateConfirm'))) run(post({ rotate: true }), copy); }}
                            className={secondaryButton}
                        >
                            {t('realEstate.properties.detail.publish.rotate')}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}

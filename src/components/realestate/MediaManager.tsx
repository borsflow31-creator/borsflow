'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import SelectRefined from '@/components/ui/SelectRefined';
import { errorFrom, inputClass, secondaryButton } from './ui';
import MediaGallery from './MediaGallery';
import MediaUploader from './MediaUploader';
import { type MediaItem } from './media';

/**
 * The Media section of a listing: one gallery per kind, each with its own drop
 * target, so an agent uploading twelve photos and one walkthrough never has to
 * tell the form which is which.
 *
 * Photos and floor plans post their bytes to the media route. Video goes direct
 * to storage with a signed URL (see MediaUploader), which is why its ceiling is
 * 200 MB and theirs is 10.
 *
 * Reordering is per gallery but positions are global, so the PATCH sends the
 * whole list in its new order -- the route keeps ids it was not told about after
 * the ones it was, so a stale client cannot drop an item it never saw.
 */

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
const FLOORPLAN_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime';

const MB = 1024 * 1024;
const LINK_KINDS = ['video', 'virtual_tour'] as const;

interface Section {
    kind: string;
    titleKey: MessageKey;
    accept?: string;
    maxBytes?: number;
    direct?: boolean;
}

const SECTIONS: Section[] = [
    { kind: 'photo', titleKey: 'realEstate.media.sections.photos', accept: PHOTO_ACCEPT, maxBytes: 10 * MB },
    { kind: 'video', titleKey: 'realEstate.media.sections.videos', accept: VIDEO_ACCEPT, maxBytes: 200 * MB, direct: true },
    { kind: 'floorplan', titleKey: 'realEstate.media.sections.floorplans', accept: FLOORPLAN_ACCEPT, maxBytes: 10 * MB },
    { kind: 'virtual_tour', titleKey: 'realEstate.media.sections.virtualTours' },
];

export default function MediaManager({
    propertyId,
    canWrite,
    onChanged,
}: {
    propertyId: string;
    canWrite: boolean;
    onChanged?: () => void;
}) {
    const { t } = useI18n();
    const base = `/api/properties/${propertyId}/media`;

    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [linkKind, setLinkKind] = useState<(typeof LINK_KINDS)[number]>('video');
    const [linkUrl, setLinkUrl] = useState('');
    const [addingLink, setAddingLink] = useState(false);
    const changedRef = useRef(onChanged);
    changedRef.current = onChanged;

    const load = useCallback(async () => {
        try {
            const res = await fetch(base);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.load')));
            setItems((await res.json()).media);
            setError('');
        } catch {
            setError(t('realEstate.media.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [base, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const done = useCallback(() => {
        void load();
        changedRef.current?.();
    }, [load]);

    const byKind = useMemo(() => {
        const map = new Map<string, MediaItem[]>();
        for (const item of items) {
            const list = map.get(item.kind) ?? [];
            list.push(item);
            map.set(item.kind, list);
        }
        return map;
    }, [items]);

    const addLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingLink(true);
        setError('');
        try {
            const res = await fetch(base, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: linkKind, externalUrl: linkUrl }),
            });
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.link')));
            setLinkUrl('');
            done();
        } catch {
            setError(t('realEstate.media.errors.link'));
        } finally {
            setAddingLink(false);
        }
    };

    /**
     * Reorder within one gallery, expressed as a global order: the moved
     * gallery's new sequence followed by everything else in the order it already
     * had. Sending only the one gallery would let the route interleave it with
     * the others however their old positions happened to fall.
     */
    const reorder = async (kind: string, orderedIds: string[]) => {
        const rest = items.filter((i) => i.kind !== kind).map((i) => i.id);
        const res = await fetch(base, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: [...orderedIds, ...rest] }),
        }).catch(() => null);
        if (!res?.ok) {
            setError(t('realEstate.media.errors.upload'));
            throw new Error('reorder failed');
        }
        void load();
    };

    const setCover = async (id: string) => {
        const res = await fetch(`${base}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCover: true }),
        });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.upload')));
        done();
    };

    const saveCaption = async (id: string, caption: string) => {
        await fetch(`${base}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption }),
        });
    };

    const remove = async (id: string) => {
        if (!confirm(t('realEstate.media.removeConfirm'))) return;
        const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.remove')));
        done();
    };

    const linkKindOptions = LINK_KINDS.map((v) => ({ value: v, label: t(`realEstate.media.kind.${v}` as MessageKey) }));

    if (loading) return <div className="skeleton h-40 rounded-lg" />;

    return (
        <div className="space-y-8">
            {error && (
                <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">
                    {error}
                </p>
            )}

            {items.length === 0 && !canWrite && (
                <div className="flex flex-col items-center text-center py-12 gap-2 text-on-surface-variant">
                    <ImageIcon className="w-8 h-8" />
                    <p className="body-md">{t('realEstate.media.empty')}</p>
                </div>
            )}

            {SECTIONS.map((section) => {
                const sectionItems = byKind.get(section.kind) ?? [];
                // A read-only viewer has no reason to see an empty section header.
                if (sectionItems.length === 0 && !canWrite) return null;

                return (
                    <section key={section.kind} className="space-y-3">
                        <div className="flex items-baseline justify-between gap-3">
                            <h3 className="title-sm text-on-surface">
                                {t(section.titleKey)}
                                {sectionItems.length > 0 && (
                                    <span className="body-sm text-on-surface-variant ml-2">{sectionItems.length}</span>
                                )}
                            </h3>
                            {section.kind === 'photo' && sectionItems.length > 1 && canWrite && (
                                <p className="body-xs text-on-surface-variant">{t('realEstate.media.reorderHint')}</p>
                            )}
                        </div>

                        {canWrite && section.accept && section.maxBytes && (
                            <MediaUploader
                                baseUrl={base}
                                kind={section.kind}
                                accept={section.accept}
                                maxBytes={section.maxBytes}
                                direct={section.direct}
                                onUploaded={done}
                            />
                        )}

                        {sectionItems.length > 0 ? (
                            <MediaGallery
                                items={sectionItems}
                                canWrite={canWrite}
                                showCover={section.kind === 'photo'}
                                onReorder={(ids) => reorder(section.kind, ids)}
                                onSetCover={section.kind === 'photo' ? setCover : undefined}
                                onSaveCaption={saveCaption}
                                onRemove={remove}
                            />
                        ) : (
                            !section.accept && canWrite && (
                                <p className="body-sm text-on-surface-variant">{t('realEstate.media.sectionEmpty')}</p>
                            )
                        )}
                    </section>
                );
            })}

            {canWrite && (
                <form onSubmit={addLink} className="bg-surface-container rounded-lg p-4 space-y-3">
                    <p className="body-sm text-on-surface">{t('realEstate.media.addLink')}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="sm:w-44">
                            <SelectRefined
                                value={linkKind}
                                options={linkKindOptions}
                                onChange={(v) => setLinkKind(v as (typeof LINK_KINDS)[number])}
                                variant="filled"
                                size="sm"
                            />
                        </div>
                        <input
                            type="url"
                            required
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder={t('realEstate.media.linkUrl')}
                            className={inputClass}
                        />
                        <button type="submit" disabled={addingLink} className={secondaryButton}>
                            {addingLink ? t('common.loading') : t('realEstate.media.addLinkSubmit')}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

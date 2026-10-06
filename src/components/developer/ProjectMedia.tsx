'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { errorFrom, inputClass, secondaryButton } from '@/components/realestate/ui';
import MediaGallery from '@/components/realestate/MediaGallery';
import MediaUploader from '@/components/realestate/MediaUploader';
import { type MediaItem } from '@/components/realestate/media';
import { PROGRAM_MEDIA_GROUPS, canBeCover, storageKindFor } from '@/lib/crm/projects';

/**
 * The Media section of a project: one gallery per kind, so photos, renders, drone
 * progress shots, plans, brochures and the quarterly report each have a home
 * rather than one undifferentiated pile.
 *
 * It reuses the listing galleries (MediaGallery, MediaUploader, MediaLightbox)
 * unchanged. Those components know nothing about projects -- they take items and
 * callbacks -- which is what makes a development's media behave exactly like a
 * listing's without a second implementation to keep in step.
 */

const MB = 1024 * 1024;

const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp';
const ACCEPT_DOC = 'image/jpeg,image/png,image/webp,application/pdf';
const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime';

/** Upload affordances per kind, derived from the storage rules so they can't drift. */
function uploadConfig(kind: string) {
    const storage = storageKindFor(kind);
    if (storage === 'video') return { accept: ACCEPT_VIDEO, maxBytes: 200 * MB, direct: true };
    if (storage === 'photo') return { accept: ACCEPT_IMAGE, maxBytes: 10 * MB, direct: false };
    return { accept: ACCEPT_DOC, maxBytes: 10 * MB, direct: false };
}

export default function ProjectMedia({
    programId,
    onChanged,
}: {
    programId: string;
    onChanged?: () => void;
}) {
    const { t } = useI18n();
    const base = `/api/developer/programs/${programId}/media`;

    const [items, setItems] = useState<MediaItem[]>([]);
    // The media route already answers whether this member may write, and the
    // project page does not track role, so take it from there rather than
    // threading it down.
    const [canWrite, setCanWrite] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [addingLink, setAddingLink] = useState(false);
    const changedRef = useRef(onChanged);
    changedRef.current = onChanged;

    const load = useCallback(async () => {
        try {
            const res = await fetch(base);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.load')));
            const data = await res.json();
            setItems(data.media);
            setCanWrite(!!data.canWrite);
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
                body: JSON.stringify({ kind: 'video', externalUrl: linkUrl }),
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

    /** Reorder within one gallery, sent as a global order (see MediaManager). */
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

    const patch = async (id: string, body: Record<string, unknown>, fallback: MessageKey) => {
        const res = await fetch(`${base}/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            setError(await errorFrom(res, t(fallback)));
            return false;
        }
        return true;
    };

    const setCover = async (id: string) => {
        if (await patch(id, { isCover: true }, 'realEstate.media.errors.upload')) done();
    };

    const saveCaption = (id: string, caption: string) => {
        void patch(id, { caption }, 'realEstate.media.errors.upload');
    };

    const remove = async (id: string) => {
        if (!confirm(t('realEstate.media.removeConfirm'))) return;
        const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.remove')));
        done();
    };

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
                    <p className="body-md">{t('realEstate.projects.media.empty')}</p>
                </div>
            )}

            {PROGRAM_MEDIA_GROUPS.map((kind) => {
                const sectionItems = byKind.get(kind) ?? [];
                if (sectionItems.length === 0 && !canWrite) return null;
                const config = uploadConfig(kind);

                return (
                    <section key={kind} className="space-y-3">
                        <div className="flex items-baseline justify-between gap-3">
                            <h3 className="title-sm text-on-surface">
                                {t(`realEstate.projects.media.kind.${kind}` as MessageKey)}
                                {sectionItems.length > 0 && (
                                    <span className="body-sm text-on-surface-variant ml-2">{sectionItems.length}</span>
                                )}
                            </h3>
                            {sectionItems.length > 1 && canWrite && (
                                <p className="body-xs text-on-surface-variant">{t('realEstate.media.reorderHint')}</p>
                            )}
                        </div>

                        {canWrite && (
                            <MediaUploader
                                baseUrl={base}
                                kind={kind}
                                accept={config.accept}
                                maxBytes={config.maxBytes}
                                direct={config.direct}
                                onUploaded={done}
                            />
                        )}

                        {sectionItems.length > 0 && (
                            <MediaGallery
                                items={sectionItems}
                                canWrite={canWrite}
                                showCover={canBeCover(kind)}
                                onReorder={(ids) => reorder(kind, ids)}
                                onSetCover={canBeCover(kind) ? setCover : undefined}
                                onSaveCaption={saveCaption}
                                onRemove={remove}
                            />
                        )}
                    </section>
                );
            })}

            {canWrite && (
                <form onSubmit={addLink} className="bg-surface-container rounded-lg p-4 space-y-3">
                    <p className="body-sm text-on-surface">{t('realEstate.projects.media.addVideoLink')}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
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

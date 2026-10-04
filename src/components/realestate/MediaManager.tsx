'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { ExternalLink, ImageIcon } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import SelectRefined from '@/components/ui/SelectRefined';
import { Badge, errorFrom, inputClass, primaryButton, secondaryButton } from './ui';

interface MediaItem {
    id: string;
    kind: string;
    url: string | null;
    externalUrl: string | null;
    fileName: string | null;
    fileType: string | null;
    caption: string | null;
    isCover: boolean;
    position: number;
}

const FILE_KINDS = ['photo', 'floorplan'] as const;
const LINK_KINDS = ['video', 'virtual_tour'] as const;

/**
 * Ordered, typed media for one listing: photos and floor plans uploaded to the
 * private bucket, videos and virtual tours added as links. Drag to reorder; the
 * first photo is the cover until another is chosen.
 */
export default function MediaManager({ propertyId, canWrite, onChanged }: { propertyId: string; canWrite: boolean; onChanged?: () => void }) {
    const { t } = useI18n();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [uploadKind, setUploadKind] = useState<(typeof FILE_KINDS)[number]>('photo');
    const [linkKind, setLinkKind] = useState<(typeof LINK_KINDS)[number]>('video');
    const [linkUrl, setLinkUrl] = useState('');
    const input = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/properties/${propertyId}/media`);
            if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.load')));
            setItems((await res.json()).media);
        } catch {
            setError(t('realEstate.media.errors.load'));
        } finally {
            setLoading(false);
        }
    }, [propertyId, t]);

    useEffect(() => { load(); }, [load]);

    const done = () => { load(); onChanged?.(); };

    const upload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setBusy(true);
        setError('');
        // Sequential: each upload picks the next position, and one failure should
        // say which file it was rather than abort the rest silently.
        for (const file of Array.from(files)) {
            const form = new FormData();
            form.append('file', file);
            form.append('kind', uploadKind);
            try {
                const res = await fetch(`/api/properties/${propertyId}/media`, { method: 'POST', body: form });
                if (!res.ok) setError(`${file.name}: ${await errorFrom(res, t('realEstate.media.errors.upload'))}`);
            } catch {
                setError(`${file.name}: ${t('realEstate.media.errors.upload')}`);
            }
        }
        if (input.current) input.current.value = '';
        setBusy(false);
        done();
    };

    const addLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const res = await fetch(`/api/properties/${propertyId}/media`, {
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
            setBusy(false);
        }
    };

    const reorder = async (result: DropResult) => {
        if (!result.destination || result.destination.index === result.source.index) return;
        const next = [...items];
        const [moved] = next.splice(result.source.index, 1);
        next.splice(result.destination.index, 0, moved);
        const previous = items;
        setItems(next);
        const res = await fetch(`/api/properties/${propertyId}/media`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: next.map(i => i.id) }),
        }).catch(() => null);
        if (!res?.ok) { setItems(previous); setError(t('realEstate.media.errors.upload')); }
    };

    const makeCover = async (id: string) => {
        const res = await fetch(`/api/properties/${propertyId}/media/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isCover: true }) });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.upload')));
        done();
    };

    const saveCaption = async (id: string, caption: string) => {
        await fetch(`/api/properties/${propertyId}/media/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption }) });
    };

    const remove = async (id: string) => {
        if (!confirm(t('realEstate.media.removeConfirm'))) return;
        const res = await fetch(`/api/properties/${propertyId}/media/${id}`, { method: 'DELETE' });
        if (!res.ok) return setError(await errorFrom(res, t('realEstate.media.errors.remove')));
        done();
    };

    const fileKindOptions = FILE_KINDS.map(v => ({ value: v, label: t(`realEstate.media.kind.${v}` as MessageKey) }));
    const linkKindOptions = LINK_KINDS.map(v => ({ value: v, label: t(`realEstate.media.kind.${v}` as MessageKey) }));

    if (loading) return <div className="skeleton h-40 rounded-lg" />;

    return (
        <div className="space-y-6">
            {error && <p className="body-sm text-error bg-error-container rounded px-3 py-2" role="alert">{error}</p>}

            {canWrite && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-surface-container rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-40">
                                <SelectRefined value={uploadKind} options={fileKindOptions} onChange={v => setUploadKind(v as (typeof FILE_KINDS)[number])} variant="filled" size="sm" />
                            </div>
                            <button type="button" disabled={busy} onClick={() => input.current?.click()} className={primaryButton}>
                                {busy ? t('common.loading') : t('realEstate.media.upload')}
                            </button>
                        </div>
                        <input
                            ref={input}
                            type="file"
                            multiple
                            accept={uploadKind === 'floorplan' ? 'image/jpeg,image/png,image/webp,application/pdf' : 'image/jpeg,image/png,image/webp'}
                            className="hidden"
                            onChange={e => upload(e.target.files)}
                        />
                        <p className="body-xs text-on-surface-variant">{t('realEstate.media.dropHint')}</p>
                    </div>

                    <form onSubmit={addLink} className="bg-surface-container rounded-lg p-4 space-y-3">
                        <p className="body-sm text-on-surface">{t('realEstate.media.addLink')}</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="sm:w-44">
                                <SelectRefined value={linkKind} options={linkKindOptions} onChange={v => setLinkKind(v as (typeof LINK_KINDS)[number])} variant="filled" size="sm" />
                            </div>
                            <input type="url" required value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder={t('realEstate.media.linkUrl')} className={inputClass} />
                            <button type="submit" disabled={busy} className={secondaryButton}>{t('realEstate.media.addLinkSubmit')}</button>
                        </div>
                    </form>
                </div>
            )}

            {items.length === 0 ? (
                <div className="flex flex-col items-center text-center py-12 gap-2 text-on-surface-variant">
                    <ImageIcon className="w-8 h-8" />
                    <p className="body-md">{t('realEstate.media.empty')}</p>
                </div>
            ) : (
                <>
                    {canWrite && <p className="body-xs text-on-surface-variant">{t('realEstate.media.reorderHint')}</p>}
                    <DragDropContext onDragEnd={reorder}>
                        <Droppable droppableId="media" direction="horizontal">
                            {provided => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {items.map((item, index) => (
                                        <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!canWrite}>
                                            {(drag, snapshot) => (
                                                <div
                                                    ref={drag.innerRef}
                                                    {...drag.draggableProps}
                                                    {...drag.dragHandleProps}
                                                    className={`bg-surface-container rounded-lg overflow-hidden ${snapshot.isDragging ? 'shadow-2xl' : ''}`}
                                                >
                                                    <div className="relative aspect-[4/3] bg-surface-container-high flex items-center justify-center">
                                                        {item.kind === 'photo' && item.url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={item.url} alt={item.caption ?? item.fileName ?? ''} className="w-full h-full object-cover" />
                                                        ) : item.externalUrl ? (
                                                            <a href={item.externalUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-primary body-sm p-3 text-center">
                                                                <ExternalLink className="w-6 h-6" />
                                                                {t('realEstate.media.openLink')}
                                                            </a>
                                                        ) : (
                                                            <span className="body-sm text-on-surface-variant p-3 text-center break-all">{item.fileName}</span>
                                                        )}
                                                        <div className="absolute top-2 left-2 flex gap-1">
                                                            <Badge>{t(`realEstate.media.kind.${item.kind}` as MessageKey)}</Badge>
                                                            {item.isCover && <Badge tone="good">{t('realEstate.media.cover')}</Badge>}
                                                        </div>
                                                    </div>
                                                    <div className="p-2 space-y-2">
                                                        {canWrite ? (
                                                            <input
                                                                defaultValue={item.caption ?? ''}
                                                                onBlur={e => e.target.value !== (item.caption ?? '') && saveCaption(item.id, e.target.value)}
                                                                placeholder={t('realEstate.media.caption')}
                                                                className="premium-input w-full px-2 py-1 text-xs"
                                                                aria-label={t('realEstate.media.caption')}
                                                            />
                                                        ) : item.caption ? <p className="body-xs text-on-surface-variant">{item.caption}</p> : null}
                                                        {canWrite && (
                                                            <div className="flex items-center justify-between body-xs">
                                                                {item.kind === 'photo' && !item.isCover ? (
                                                                    <button type="button" onClick={() => makeCover(item.id)} className="text-primary hover:underline">{t('realEstate.media.setCover')}</button>
                                                                ) : <span />}
                                                                <button type="button" onClick={() => remove(item.id)} className="text-error hover:underline">{t('realEstate.media.remove')}</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                </>
            )}
        </div>
    );
}

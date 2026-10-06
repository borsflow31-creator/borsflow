'use client';

import { useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { ExternalLink, FileText, Film, GripVertical, Image as ImageIcon, Play, Star, Trash2 } from 'lucide-react';
import { useI18n, type MessageKey } from '@/i18n/I18nProvider';
import { Badge } from './ui';
import MediaLightbox from './MediaLightbox';
import { embedUrl, formatSize, isImage, isPdf, isPreviewable, isVideoFile, type MediaItem } from './media';

/**
 * One gallery: a grid of thumbnails for a single media kind.
 *
 * Reordering is optimistic and rolls back, because the alternative -- waiting for
 * the server before the tile moves -- makes dragging feel broken. `onReorder`
 * gets the ids in their new order and the caller is expected to reject by
 * throwing, which is what triggers the rollback.
 *
 * Shared by listings and projects: it knows nothing about either, only about the
 * items it was handed and which controls it was allowed to show.
 */
export default function MediaGallery({
    items,
    canWrite,
    showCover = true,
    onReorder,
    onSetCover,
    onSaveCaption,
    onRemove,
}: {
    items: MediaItem[];
    canWrite: boolean;
    /** Cover only means something for photos, so the units gallery turns it off. */
    showCover?: boolean;
    onReorder?: (orderedIds: string[]) => Promise<void>;
    onSetCover?: (id: string) => void;
    onSaveCaption?: (id: string, caption: string) => void;
    onRemove?: (id: string) => void;
}) {
    const { t } = useI18n();
    const [order, setOrder] = useState<MediaItem[] | null>(null);
    const [lightbox, setLightbox] = useState<number | null>(null);

    // While a reorder is in flight we render our own optimistic order; otherwise
    // whatever the parent last loaded.
    const shown = order ?? items;
    const reorderable = canWrite && !!onReorder && shown.length > 1;

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination || result.destination.index === result.source.index || !onReorder) return;
        const next = [...shown];
        const [moved] = next.splice(result.source.index, 1);
        next.splice(result.destination.index, 0, moved);
        setOrder(next);
        try {
            await onReorder(next.map((i) => i.id));
        } finally {
            // Either way the parent reloads and becomes the truth again.
            setOrder(null);
        }
    };

    if (shown.length === 0) return null;

    const tile = (item: MediaItem, index: number) => {
        const embed = embedUrl(item.externalUrl);
        const label = item.caption ?? item.fileName ?? '';
        const previewable = isPreviewable(item);

        return (
            <div className="bg-surface-container rounded-lg overflow-hidden group">
                <div className="relative aspect-[4/3] bg-surface-container-high flex items-center justify-center">
                    {isImage(item) && item.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={label} loading="lazy" className="w-full h-full object-cover" />
                    ) : isVideoFile(item) && item.url ? (
                        <>
                            <video src={item.url} preload="metadata" muted playsInline className="w-full h-full object-cover" />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                                <Play className="w-8 h-8 text-white drop-shadow" />
                            </span>
                        </>
                    ) : embed ? (
                        <span className="flex flex-col items-center gap-1 text-on-surface-variant body-sm p-3 text-center">
                            <Film className="w-7 h-7" />
                            {t('realEstate.media.kind.video')}
                        </span>
                    ) : isPdf(item) ? (
                        <span className="flex flex-col items-center gap-1 text-on-surface-variant body-sm p-3 text-center">
                            <FileText className="w-7 h-7" />
                            PDF
                        </span>
                    ) : item.externalUrl ? (
                        <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-1 text-primary body-sm p-3 text-center"
                        >
                            <ExternalLink className="w-6 h-6" />
                            {t('realEstate.media.openLink')}
                        </a>
                    ) : (
                        <span className="flex flex-col items-center gap-1 text-on-surface-variant body-sm p-3 text-center">
                            <ImageIcon className="w-7 h-7" />
                            <span className="break-all body-xs">{item.fileName}</span>
                        </span>
                    )}

                    {previewable && (
                        <button
                            type="button"
                            onClick={() => setLightbox(index)}
                            className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={t('realEstate.media.lightbox.open')}
                        />
                    )}

                    <div className="absolute top-2 left-2 flex flex-wrap gap-1 pointer-events-none">
                        {item.isCover && <Badge tone="good">{t('realEstate.media.cover')}</Badge>}
                        {item.externalUrl && <Badge>{t('realEstate.media.link')}</Badge>}
                    </div>

                    {reorderable && (
                        <span
                            className="absolute top-2 right-2 p-1 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-hidden="true"
                        >
                            <GripVertical className="w-4 h-4" />
                        </span>
                    )}
                </div>

                <div className="p-2 space-y-2">
                    {canWrite && onSaveCaption ? (
                        <input
                            defaultValue={item.caption ?? ''}
                            onBlur={(e) => e.target.value !== (item.caption ?? '') && onSaveCaption(item.id, e.target.value)}
                            placeholder={t('realEstate.media.caption')}
                            className="premium-input w-full px-2 py-1 text-xs"
                            aria-label={t('realEstate.media.caption')}
                        />
                    ) : item.caption ? (
                        <p className="body-xs text-on-surface-variant line-clamp-2">{item.caption}</p>
                    ) : null}

                    <div className="flex items-center justify-between gap-2 body-xs">
                        <span className="text-on-surface-variant truncate">
                            {item.size ? formatSize(item.size) : ''}
                        </span>
                        {canWrite && (
                            <span className="flex items-center gap-2 shrink-0">
                                {showCover && onSetCover && isImage(item) && !item.isCover && (
                                    <button
                                        type="button"
                                        onClick={() => onSetCover(item.id)}
                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                    >
                                        <Star className="w-3.5 h-3.5" />
                                        {t('realEstate.media.setCover')}
                                    </button>
                                )}
                                {onRemove && (
                                    <button
                                        type="button"
                                        onClick={() => onRemove(item.id)}
                                        className="inline-flex items-center gap-1 text-error hover:underline"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        {t('realEstate.media.remove')}
                                    </button>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const grid = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';

    return (
        <>
            {reorderable ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId={`media-${shown[0]?.kind ?? 'items'}`} direction="horizontal">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={grid}>
                                {shown.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(drag, snapshot) => (
                                            <div
                                                ref={drag.innerRef}
                                                {...drag.draggableProps}
                                                {...drag.dragHandleProps}
                                                className={snapshot.isDragging ? 'shadow-2xl rounded-lg' : ''}
                                            >
                                                {tile(item, index)}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            ) : (
                <div className={grid}>
                    {shown.map((item, index) => (
                        <div key={item.id}>{tile(item, index)}</div>
                    ))}
                </div>
            )}

            {lightbox !== null && (
                <MediaLightbox
                    items={shown.filter(isPreviewable)}
                    startIndex={Math.max(0, shown.filter(isPreviewable).findIndex((i) => i.id === shown[lightbox]?.id))}
                    onClose={() => setLightbox(null)}
                />
            )}
        </>
    );
}

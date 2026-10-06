'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { embedUrl, isImage, isPdf, isVideoFile, type MediaItem } from './media';

/**
 * Full-screen viewer for one gallery, shared by listings and projects.
 *
 * It owns the keyboard: arrows step through the set and Escape closes, because a
 * gallery someone opened to compare two rooms is unusable if every step needs the
 * mouse. Body scroll is locked while open so a swipe on a phone moves between
 * photos rather than scrolling the page behind them.
 *
 * Playback is paused by unmounting: each slide renders only the current item, so
 * stepping off a video stops it instead of leaving audio running behind a photo.
 */
export default function MediaLightbox({
    items,
    startIndex,
    onClose,
}: {
    items: MediaItem[];
    startIndex: number;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const [index, setIndex] = useState(startIndex);

    const count = items.length;
    const step = useCallback((delta: number) => {
        setIndex((current) => (current + delta + count) % count);
    }, [count]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') step(1);
            else if (e.key === 'ArrowLeft') step(-1);
        };
        window.addEventListener('keydown', onKey);
        const { overflow } = document.body.style;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [onClose, step]);

    const item = items[index];
    if (!item) return null;

    const embed = embedUrl(item.externalUrl);
    const label = item.caption ?? item.fileName ?? '';

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/90 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={t('realEstate.media.lightbox.title')}
        >
            <div className="flex items-center justify-between gap-3 p-3 text-white shrink-0">
                <p className="body-sm truncate min-w-0">
                    {label}
                    {count > 1 && <span className="opacity-60 ml-2">{index + 1} / {count}</span>}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                    {item.externalUrl && (
                        <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full hover:bg-white/10"
                            aria-label={t('realEstate.media.openLink')}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    )}
                    {item.url && !item.externalUrl && (
                        <a
                            href={item.url}
                            download={item.fileName ?? true}
                            className="p-2 rounded-full hover:bg-white/10"
                            aria-label={t('common.download')}
                        >
                            <Download className="w-5 h-5" />
                        </a>
                    )}
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label={t('common.close')}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Clicking the backdrop closes; clicking the media itself must not. */}
            <div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
                <div className="max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {isImage(item) && item.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={label} className="max-w-full max-h-full object-contain" />
                    ) : isVideoFile(item) && item.url ? (
                        <video src={item.url} controls autoPlay playsInline className="max-w-full max-h-full" />
                    ) : embed ? (
                        <iframe
                            src={embed}
                            title={label || t('realEstate.media.lightbox.title')}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                            className="w-[90vw] h-[50.6vw] max-h-[80vh] max-w-full border-0 bg-black"
                        />
                    ) : isPdf(item) && item.url ? (
                        <iframe src={item.url} title={label} className="w-[90vw] h-[80vh] border-0 bg-white" />
                    ) : (
                        <p className="text-white body-md p-6 text-center">{t('realEstate.media.lightbox.unavailable')}</p>
                    )}
                </div>
            </div>

            {count > 1 && (
                <>
                    <button
                        type="button"
                        onClick={() => step(-1)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 text-white hover:bg-black/60"
                        aria-label={t('realEstate.media.lightbox.previous')}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        type="button"
                        onClick={() => step(1)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 text-white hover:bg-black/60"
                        aria-label={t('realEstate.media.lightbox.next')}
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </>
            )}
        </div>
    );
}

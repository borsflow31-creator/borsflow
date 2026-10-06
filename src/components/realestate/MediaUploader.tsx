'use client';

import { useRef, useState } from 'react';
import { AlertCircle, Upload } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface UploadItem {
    key: string;
    name: string;
    progress: number;
    error?: string;
}

/** Upload with progress (fetch has no upload progress, XHR does). */
function xhrUpload(
    method: 'POST' | 'PUT',
    url: string,
    body: FormData | File,
    onProgress: (pct: number) => void,
    contentType?: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        if (contentType) xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve();
            let message = `Upload failed (${xhr.status})`;
            try {
                message = JSON.parse(xhr.responseText).error || message;
            } catch {
                /* keep the status-code message */
            }
            reject(new Error(message));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(body);
    });
}

/**
 * The drop target and upload queue for one media kind.
 *
 * Photos and floor plans are posted to the media route as multipart. Videos take
 * a different road: the route hands back a signed URL, the browser PUTs the file
 * straight to storage, and only then is the row recorded. A 200 MB walkthrough
 * would otherwise have to be buffered whole in a route handler and travel the
 * network twice.
 *
 * Uploads run one at a time so a per-file progress bar means something and so a
 * dozen dropped photos don't all hit the rate limit at once. A failure is shown
 * against the file that failed and does not cancel the rest.
 */
export default function MediaUploader({
    baseUrl,
    kind,
    accept,
    maxBytes,
    direct = false,
    onUploaded,
}: {
    /** e.g. `/api/properties/<id>/media` */
    baseUrl: string;
    kind: string;
    accept: string;
    maxBytes: number;
    /** Video: sign a URL and upload to storage instead of posting the bytes here. */
    direct?: boolean;
    onUploaded: () => void;
}) {
    const { t } = useI18n();
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    const megabytes = Math.floor(maxBytes / (1024 * 1024));

    const send = async (file: File, key: string) => {
        const onProgress = (progress: number) =>
            setUploads((current) => current.map((u) => (u.key === key ? { ...u, progress } : u)));

        if (!direct) {
            const form = new FormData();
            form.append('file', file);
            form.append('kind', kind);
            await xhrUpload('POST', baseUrl, form, onProgress);
            return;
        }

        // 1. Ask the server where to put it. It picks the path, so the browser
        //    cannot choose where in the bucket its bytes land.
        const signed = await fetch(`${baseUrl}/upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, fileType: file.type, size: file.size }),
        });
        const signedBody = await signed.json().catch(() => null);
        if (!signed.ok) throw new Error(signedBody?.error || t('realEstate.media.errors.upload'));

        // 2. The bytes go to storage, never through the app.
        await xhrUpload('PUT', signedBody.uploadUrl, file, onProgress, file.type);

        // 3. Record the row. The server re-checks the object really arrived.
        const recorded = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, filePath: signedBody.filePath, fileName: file.name, fileType: file.type }),
        });
        if (!recorded.ok) {
            const body = await recorded.json().catch(() => null);
            throw new Error(body?.error || t('realEstate.media.errors.upload'));
        }
    };

    const addFiles = async (list: FileList | File[] | null) => {
        const picked = list ? Array.from(list) : [];
        if (picked.length === 0) return;

        const items: UploadItem[] = picked.map((f, i) => ({
            key: `${Date.now()}-${i}-${f.name}`,
            name: f.name,
            progress: 0,
        }));
        setUploads((current) => [...current, ...items]);

        for (const [i, file] of picked.entries()) {
            const { key } = items[i];
            const fail = (message: string) =>
                setUploads((current) => current.map((u) => (u.key === key ? { ...u, error: message } : u)));

            if (file.size > maxBytes) {
                fail(t('realEstate.media.errors.tooLarge', { size: String(megabytes) }));
                continue;
            }
            try {
                await send(file, key);
                setUploads((current) => current.filter((u) => u.key !== key));
                onUploaded();
            } catch (err) {
                fail(err instanceof Error ? err.message : t('realEstate.media.errors.upload'));
            }
        }

        if (input.current) input.current.value = '';
    };

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    void addFiles(e.dataTransfer.files);
                }}
                className={`w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
                    dragOver ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/60'
                }`}
            >
                <Upload className="w-6 h-6 text-on-surface-variant" />
                <span className="body-sm text-on-surface">{t('realEstate.media.dropzone.title')}</span>
                <span className="body-xs text-on-surface-variant text-center">
                    {t('realEstate.media.dropzone.hint', { size: String(megabytes) })}
                </span>
            </button>

            <input
                ref={input}
                type="file"
                multiple
                accept={accept}
                className="hidden"
                onChange={(e) => void addFiles(e.target.files)}
            />

            {uploads.length > 0 && (
                <ul className="space-y-1.5">
                    {uploads.map((u) => (
                        <li key={u.key} className="bg-surface-container rounded px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2 body-xs">
                                <span className="truncate min-w-0">{u.name}</span>
                                <span className={`shrink-0 ${u.error ? 'text-error' : 'text-on-surface-variant'}`}>
                                    {u.error ? (
                                        <span className="inline-flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {u.error}
                                        </span>
                                    ) : (
                                        `${u.progress}%`
                                    )}
                                </span>
                            </div>
                            {!u.error && (
                                <div className="mt-1.5 h-1 rounded-full bg-surface-container-high overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-[width] duration-200"
                                        style={{ width: `${u.progress}%` }}
                                    />
                                </div>
                            )}
                            {u.error && (
                                <button
                                    type="button"
                                    onClick={() => setUploads((current) => current.filter((x) => x.key !== u.key))}
                                    className="mt-1 body-xs text-primary hover:underline"
                                >
                                    {t('common.dismiss')}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

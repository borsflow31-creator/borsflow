'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, FileText, FileSpreadsheet, FileArchive, Image as ImageIcon, Loader2, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/I18nProvider';

interface LeadFileRow {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  createdAt: string;
  uploadedById: string | null;
  uploadedBy: { id: string; name: string | null; email: string } | null;
}

interface UploadItem {
  key: string;
  name: string;
  progress: number;
  error?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/*,.heic,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.odt,.ods,.txt,.csv,.zip';
const PREVIEWABLE = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  const cls = 'h-5 w-5';
  if (type.startsWith('image/')) return <ImageIcon className={cls} strokeWidth={1.75} />;
  if (type.includes('sheet') || type.includes('excel') || type === 'text/csv') return <FileSpreadsheet className={cls} strokeWidth={1.75} />;
  if (type.includes('zip')) return <FileArchive className={cls} strokeWidth={1.75} />;
  return <FileText className={cls} strokeWidth={1.75} />;
}

/** Upload with progress (fetch has no upload progress, XHR does). */
function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (${xhr.status})`;
      try { message = JSON.parse(xhr.responseText).error || message; } catch { /* keep default */ }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

export default function LeadFiles({
  leadId,
  onCountChange,
}: {
  leadId: string;
  onCountChange?: (count: number) => void;
}) {
  const { t, formatDateTime } = useI18n();
  const [files, setFiles] = useState<LeadFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const myId = useSession().data?.user?.id ?? null;
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<LeadFileRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeadFileRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const base = `/api/leads/${leadId}/files`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('crm.files.loadFailed'));
      setFiles(data.files);
      setCanWrite(!!data.canWrite);
      setCanModerate(!!data.canModerate);
      onCountChange?.(data.files.length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crm.files.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [base, onCountChange, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFiles = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (picked.length === 0) return;
    const items: UploadItem[] = picked.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, progress: 0 }));
    setUploads((current) => [...current, ...items]);

    // Upload one at a time so progress is meaningful and limits aren't hit at once
    for (const [i, file] of picked.entries()) {
      const key = items[i].key;
      const fail = (message: string) => setUploads((current) => current.map((u) => (u.key === key ? { ...u, error: message } : u)));
      if (file.size > MAX_BYTES) { fail(t('crm.files.tooLarge')); continue; }
      try {
        await uploadWithProgress(base, file, (progress) =>
          setUploads((current) => current.map((u) => (u.key === key ? { ...u, progress } : u)))
        );
        setUploads((current) => current.filter((u) => u.key !== key));
        await load();
      } catch (err) {
        fail(err instanceof Error ? err.message : t('crm.files.uploadFailed'));
      }
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${base}/${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('crm.files.deleteFailed'));
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crm.files.deleteFailed'));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canWrite ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
          className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors ${
            dragOver ? 'border-secondary bg-secondary/5' : 'border-outline-variant/30 bg-surface-container-low hover:border-secondary/40'
          }`}
        >
          <Upload className="mb-2 h-6 w-6 text-on-surface-variant" strokeWidth={1.75} />
          <span className="text-sm font-medium text-on-surface">{t('crm.files.dropPrompt')}</span>
          <span className="mt-1 text-xs text-on-surface-variant">{t('crm.files.limits')}</span>
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { const list = e.target.files; e.target.value = ''; if (list) void addFiles(list); }}
      />

      {uploads.length > 0 ? (
        <ul className="space-y-2">
          {uploads.map((u) => (
            <li key={u.key} className="rounded-lg border border-outline-variant/15 px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-on-surface">{u.name}</span>
                {u.error ? (
                  <button type="button" onClick={() => setUploads((c) => c.filter((x) => x.key !== u.key))} aria-label={t('common.close')} className="text-on-surface-variant hover:text-on-surface">
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="tabular-nums text-xs text-on-surface-variant">{u.progress}%</span>
                )}
              </div>
              {u.error ? (
                <p className="mt-1 text-xs text-error">{u.error}</p>
              ) : (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                  <div className="h-full rounded-full bg-secondary transition-[width]" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div> : null}

      {loading ? (
        <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-on-surface-variant" />
      ) : files.length === 0 ? (
        <div className="rounded-xl bg-surface-container-low px-6 py-8 text-center">
          <Paperclip className="mx-auto mb-2 h-6 w-6 text-on-surface-variant/50" strokeWidth={1.75} />
          <p className="text-sm text-on-surface-variant">{t('crm.files.empty')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-outline-variant/10 rounded-xl border border-outline-variant/10">
          {files.map((file) => {
            const canDelete = canWrite && (canModerate || file.uploadedById === myId);
            const previewable = PREVIEWABLE.includes(file.fileType);
            return (
              <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
                {file.fileType.startsWith('image/') && file.fileType !== 'image/heic' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${base}/${file.id}?inline=1`} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover bg-surface-container-high" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                    <FileIcon type={file.fileType} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-on-surface" title={file.fileName}>{file.fileName}</p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {formatSize(file.size)} · {file.uploadedBy?.name || file.uploadedBy?.email || t('crm.files.unknownUser')} · {formatDateTime(file.createdAt)}
                  </p>
                </div>
                {previewable ? (
                  <button type="button" onClick={() => setPreview(file)} aria-label={t('crm.files.preview')} title={t('crm.files.preview')} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
                    <Eye className="h-4 w-4" />
                  </button>
                ) : null}
                <a href={`${base}/${file.id}`} aria-label={t('crm.files.download')} title={t('crm.files.download')} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
                  <Download className="h-4 w-4" />
                </a>
                {canDelete ? (
                  <button type="button" onClick={() => setConfirmDelete(file)} aria-label={t('crm.files.delete')} title={t('crm.files.delete')} className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error">
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {preview ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/85 p-4" onClick={() => setPreview(null)}>
          <div className="mb-3 flex items-center justify-between gap-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="truncate text-sm font-medium">{preview.fileName}</span>
            <div className="flex items-center gap-1">
              <a href={`${base}/${preview.id}`} aria-label={t('crm.files.download')} className="rounded-lg p-2 hover:bg-white/10">
                <Download className="h-5 w-5" />
              </a>
              <button type="button" onClick={() => setPreview(null)} aria-label={t('common.close')} className="rounded-lg p-2 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {preview.fileType === 'application/pdf' ? (
              <iframe src={`${base}/${preview.id}?inline=1`} title={preview.fileName} className="h-full w-full max-w-4xl rounded-lg bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${base}/${preview.id}?inline=1`} alt={preview.fileName} className="max-h-full max-w-full rounded-lg object-contain" />
            )}
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setConfirmDelete(null)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-on-surface">{t('crm.files.deleteTitle', { name: confirmDelete.fileName })}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">{t('crm.files.deleteBody')}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} disabled={deleting} className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => void doDelete()} disabled={deleting} className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

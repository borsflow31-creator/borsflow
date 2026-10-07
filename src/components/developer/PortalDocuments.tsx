'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2, PenTool } from 'lucide-react';

interface PortalDoc {
  id: string;
  kind: 'reservation' | 'contract';
  number: string;
  title: string;
  status: 'sent' | 'accepted';
  sentAt: string | null;
  acceptedAt: string | null;
  acceptedName: string | null;
}

/**
 * The documents a developer has sent the buyer, and the place they accept them.
 *
 * Lives inside the buyer's purchase space, which is already behind the one-time
 * code, so every request here carries that session. The page's wording is English
 * throughout, like the rest of the portal.
 *
 * Accepting asks for the full name typed out and an explicit tick: a click on a
 * button alone is too easy to do by accident for something that binds a purchase.
 */
export default function PortalDocuments({
  token,
  sessionToken,
  onSessionExpired,
}: {
  token: string;
  sessionToken: string;
  /** Called when the server says the session has lapsed, so the page can ask for a new code. */
  onSessionExpired: () => void;
}) {
  const [docs, setDocs] = useState<PortalDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const headers = useCallback(
    (json = false): HeadersInit => ({
      Authorization: `Bearer ${sessionToken}`,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    }),
    [sessionToken]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/public/buyer/${token}/documents`, { headers: headers() });
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) throw new Error('failed');
      setDocs((await res.json()).documents ?? []);
    } catch {
      setError('We could not load your documents. Please try again.');
    }
  }, [token, headers, onSessionExpired]);

  useEffect(() => { load(); }, [load]);

  /** Fetched with the session header, so shown as a blob rather than a plain link. */
  const open = async (doc: PortalDoc) => {
    // Opened first, synchronously: browsers block a window opened after an await.
    const win = window.open('', '_blank');
    setOpening(doc.id);
    try {
      const res = await fetch(`/api/public/buyer/${token}/documents/${doc.id}/pdf`, { headers: headers() });
      if (res.status === 401) {
        win?.close();
        return onSessionExpired();
      }
      if (!res.ok) throw new Error('failed');
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch {
      win?.close();
      setError('We could not open that document. Please try again.');
    } finally {
      setOpening(null);
    }
  };

  const accept = async (doc: PortalDoc) => {
    setSubmitting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/public/buyer/${token}/documents/${doc.id}/accept`, {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ name, confirm }),
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not record your acceptance.');
      setAccepting(null);
      setName('');
      setConfirm(false);
      await load();
    } catch (err: any) {
      setAcceptError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !docs) {
    return <p className="text-sm text-slate-600 py-6 text-center">{error}</p>;
  }
  if (!docs) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }
  if (docs.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Nothing has been sent to you yet. Documents your developer shares will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {docs.map((doc) => {
        const isAccepting = accepting === doc.id;
        return (
          <div key={doc.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{doc.title}</h3>
                <p className="text-xs text-slate-500">
                  {doc.number}
                  {doc.sentAt && ` · sent ${new Date(doc.sentAt).toLocaleDateString()}`}
                </p>
              </div>
              {doc.status === 'accepted' ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">Awaiting your acceptance</span>
              )}
            </div>

            {doc.status === 'accepted' && doc.acceptedAt && (
              <p className="text-xs text-slate-600">
                Accepted by <strong>{doc.acceptedName}</strong> on {new Date(doc.acceptedAt).toLocaleString()}.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => open(doc)}
                disabled={opening === doc.id}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {opening === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                {doc.status === 'accepted' ? 'Download accepted copy' : 'Read the document'}
              </button>
              {doc.status === 'sent' && !isAccepting && (
                <button
                  onClick={() => { setAccepting(doc.id); setAcceptError(null); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <PenTool className="w-3.5 h-3.5" /> Accept
                </button>
              )}
            </div>

            {isAccepting && (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Read the document first. By accepting you agree to it as written. Your name, the time, and details of this device
                  are recorded with your acceptance.
                </p>
                <label className="block text-xs font-semibold text-slate-700">
                  Your full name
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
                  <span>I have read {doc.number} and I accept it.</span>
                </label>
                {acceptError && <p role="alert" className="text-xs text-red-700">{acceptError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => accept(doc)}
                    disabled={submitting || name.trim().length < 3 || !confirm}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm acceptance
                  </button>
                  <button
                    onClick={() => { setAccepting(null); setAcceptError(null); }}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

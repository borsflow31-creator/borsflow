'use client';

import { useEffect, useState } from 'react';
import { cachedJson, peekCached } from '@/lib/client-cache';

const DEFAULT_CURRENCY = 'EUR';

/**
 * The workspace's currency, for pages that print money. Reads the same cached
 * workspace request the app shell already makes, so it costs no extra round trip.
 *
 * Falls back to EUR (what the rest of the developer module prints) while the
 * request is in flight or if it fails, so a page never shows a bare number.
 */
export function useWorkspaceCurrency(workspaceId: string): string {
    const url = workspaceId ? `/api/workspaces/${workspaceId}` : '';
    const [currency, setCurrency] = useState<string>(
        () => (url ? peekCached<{ workspace?: { currency?: string } }>(url)?.workspace?.currency : undefined) || DEFAULT_CURRENCY
    );

    useEffect(() => {
        if (!url) return;
        let cancelled = false;
        cachedJson<{ workspace?: { currency?: string } }>(url)
            .then((data) => { if (!cancelled && data.workspace?.currency) setCurrency(data.workspace.currency); })
            .catch(() => { /* keep the fallback */ });
        return () => { cancelled = true; };
    }, [url]);

    return currency;
}

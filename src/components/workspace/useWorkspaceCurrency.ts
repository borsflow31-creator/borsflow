'use client';

import { useEffect, useState } from 'react';
import { cachedJson, peekCached } from '@/lib/client-cache';
import { DEFAULT_CURRENCY } from '@/lib/currencies';

/**
 * The workspace's currency — the one set in Settings, which everything that
 * prints money should use. Reads the same cached workspace request the app shell
 * already makes, so it costs no extra round trip.
 *
 * While that request is in flight it returns the shared default rather than a
 * module-local one: this used to fall back to EUR here and to USD elsewhere, so
 * the same amount could be labelled two ways on two pages of the same app.
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

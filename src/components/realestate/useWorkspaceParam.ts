'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/appStore';

/**
 * The workspace a page is showing: `?workspace=` if present, else the one the
 * store remembers.
 *
 * `ready` waits for the store to restore from localStorage. Without it a direct
 * visit renders the "no workspace" screen for a frame before the real one -- the
 * same flash the CRM page guards against, extracted here so every new page does.
 * zustand omits the persist API during SSR, where there is no localStorage.
 */
export function useWorkspaceParam(): { workspaceId: string; ready: boolean } {
    const searchParams = useSearchParams();
    const { currentWorkspaceId } = useAppStore();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const store = useAppStore.persist;
        if (!store) {
            setReady(true);
            return;
        }
        if (store.hasHydrated()) {
            setReady(true);
            return;
        }
        return store.onFinishHydration(() => setReady(true));
    }, []);

    return { workspaceId: searchParams.get('workspace') || currentWorkspaceId || '', ready };
}

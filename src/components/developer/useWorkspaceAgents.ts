'use client';

import { useEffect, useState } from 'react';
import { cachedJson } from '@/lib/client-cache';

export interface WorkspaceAgent {
    id: string;
    name: string;
}

/**
 * The people a sale can be credited to: the workspace's owner and its members.
 * Reads the cached workspace request the shell already makes, so it costs nothing
 * extra. Empty while loading or on failure -- every use treats the agent as
 * optional, so a missing list degrades to "no agent" rather than an error.
 */
export function useWorkspaceAgents(workspaceId: string): WorkspaceAgent[] {
    const [agents, setAgents] = useState<WorkspaceAgent[]>([]);

    useEffect(() => {
        if (!workspaceId) return;
        let cancelled = false;
        cachedJson<{ workspace?: any }>(`/api/workspaces/${workspaceId}`)
            .then(({ workspace }) => {
                if (cancelled || !workspace) return;
                const people = new Map<string, string>();
                const add = (u?: { id: string; name?: string | null; email?: string | null }) => {
                    if (u) people.set(u.id, u.name || u.email || u.id);
                };
                add(workspace.owner);
                for (const m of workspace.members ?? []) add(m.user);
                setAgents([...people].map(([id, name]) => ({ id, name })));
            })
            .catch(() => { /* optional */ });
        return () => { cancelled = true; };
    }, [workspaceId]);

    return agents;
}

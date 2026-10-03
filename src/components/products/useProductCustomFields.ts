'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProductCustomField, ProductCustomFieldType } from '@/types';

export type CustomFieldWithUsage = ProductCustomField & { usageCount?: number };

// One shared list per workspace: creating a field in the import dialog updates
// the manager, the product form and every mapping dropdown at once.
const cache = new Map<string, CustomFieldWithUsage[]>();
const listeners = new Map<string, Set<(fields: CustomFieldWithUsage[]) => void>>();

function publish(workspaceId: string, fields: CustomFieldWithUsage[]) {
  const sorted = [...fields].sort((a, b) => a.position - b.position);
  cache.set(workspaceId, sorted);
  listeners.get(workspaceId)?.forEach((fn) => fn(sorted));
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function useProductCustomFields(workspaceId: string) {
  const [fields, setFields] = useState<CustomFieldWithUsage[]>(() => cache.get(workspaceId) ?? []);
  const [loading, setLoading] = useState(!cache.has(workspaceId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await request<{ fields: CustomFieldWithUsage[] }>(
        `/api/products/custom-fields?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      publish(workspaceId, data.fields);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load custom fields');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const set = listeners.get(workspaceId) ?? new Set();
    set.add(setFields);
    listeners.set(workspaceId, set);
    setFields(cache.get(workspaceId) ?? []);
    void reload();
    return () => {
      set.delete(setFields);
    };
  }, [workspaceId, reload]);

  const create = useCallback(
    async (input: { label: string; key?: string; type: ProductCustomFieldType }) => {
      const { field } = await request<{ field: CustomFieldWithUsage }>(
        '/api/products/custom-fields',
        json('POST', { workspaceId, ...input })
      );
      publish(workspaceId, [...(cache.get(workspaceId) ?? []), field]);
      return field;
    },
    [workspaceId]
  );

  const update = useCallback(
    async (id: string, input: { label?: string; type?: ProductCustomFieldType; position?: number }) => {
      const { field } = await request<{ field: CustomFieldWithUsage }>(
        `/api/products/custom-fields/${id}`,
        json('PATCH', input)
      );
      publish(
        workspaceId,
        (cache.get(workspaceId) ?? []).map((f) => (f.id === id ? { ...f, ...field } : f))
      );
      return field;
    },
    [workspaceId]
  );

  const remove = useCallback(
    async (id: string) => {
      await request(`/api/products/custom-fields/${id}`, { method: 'DELETE' });
      publish(workspaceId, (cache.get(workspaceId) ?? []).filter((f) => f.id !== id));
    },
    [workspaceId]
  );

  /** Swap a field with its neighbour (dir -1 = up, 1 = down). */
  const move = useCallback(
    async (id: string, dir: -1 | 1) => {
      const list = [...(cache.get(workspaceId) ?? [])];
      const at = list.findIndex((f) => f.id === id);
      const to = at + dir;
      if (at < 0 || to < 0 || to >= list.length) return;
      [list[at], list[to]] = [list[to], list[at]];
      const renumbered = list.map((f, i) => ({ ...f, position: i }));
      publish(workspaceId, renumbered);
      await Promise.all([
        request(`/api/products/custom-fields/${list[at].id}`, json('PATCH', { position: at })),
        request(`/api/products/custom-fields/${list[to].id}`, json('PATCH', { position: to })),
      ]).catch(async (err) => {
        await reload();
        throw err;
      });
    },
    [workspaceId, reload]
  );

  return { fields, loading, error, reload, create, update, remove, move };
}

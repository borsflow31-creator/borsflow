// Client wrappers for the workspace chat API. Every call throws an Error with
// the server's message on failure, so callers can show it as-is.

import type { Channel, ChatPermissions, MessageRow } from './types'

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  return data as T
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

export function chatApi(workspaceId: string) {
  const base = `/api/workspaces/${workspaceId}/chat`
  return {
    channels: () =>
      call<{ channels: Channel[] } & ChatPermissions>(`${base}/channels`),
    createChannel: (input: { name: string; description?: string; isPrivate?: boolean; memberIds?: string[] }) =>
      call<{ channel: Channel }>(`${base}/channels`, json('POST', input)),
    updateChannel: (channelId: string, input: { name?: string; description?: string }) =>
      call<{ channel: Channel }>(`${base}/channels/${channelId}`, json('PATCH', input)),
    deleteChannel: (channelId: string) =>
      call<{ success: true }>(`${base}/channels/${channelId}`, { method: 'DELETE' }),
    setMembers: (channelId: string, memberIds: string[]) =>
      call<{ memberIds: string[] }>(`${base}/channels/${channelId}/members`, json('PUT', { memberIds })),
    markRead: (channelId: string) =>
      call<{ lastReadAt: string }>(`${base}/channels/${channelId}/read`, { method: 'POST' }),

    messages: (channelId: string, params: Record<string, string> = {}) =>
      call<{ messages: MessageRow[]; hasMore?: boolean; hasNewer?: boolean; parent?: MessageRow }>(
        `${base}/messages?${new URLSearchParams({ channelId, ...params })}`,
      ),
    send: (input: {
      channelId: string
      content: string
      parentId?: string | null
      clientMsgId?: string
      filePath?: string
      fileName?: string
      fileType?: string
    }) => call<{ message: MessageRow }>(`${base}/messages`, json('POST', input)),
    edit: (messageId: string, content: string) =>
      call<{ message: MessageRow }>(`${base}/messages/${messageId}`, json('PATCH', { content })),
    remove: (messageId: string) =>
      call<{ message: MessageRow }>(`${base}/messages/${messageId}`, { method: 'DELETE' }),
    react: (messageId: string, emoji: string) =>
      call<{ message: MessageRow }>(`${base}/messages/${messageId}/reactions`, json('POST', { emoji })),
    pin: (messageId: string, pinned: boolean) =>
      call<{ message: MessageRow }>(`${base}/messages/${messageId}/pin`, json('POST', { pinned })),

    upload: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return call<{ filePath: string; fileName: string; fileType: string }>(`${base}/upload`, { method: 'POST', body: fd })
    },
    search: (q: string, cursor?: string) =>
      call<{ results: (MessageRow & { channel: { id: string; name: string } })[]; nextCursor: string | null }>(
        `${base}/search?${new URLSearchParams({ q, ...(cursor ? { cursor } : {}) })}`,
      ),
  }
}

export type ChatApi = ReturnType<typeof chatApi>

export const newClientMsgId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Upload (if any) then post. Returns the saved message. */
export async function sendWithAttachment(
  api: ChatApi,
  input: { channelId: string; content: string; file: File | null; parentId?: string | null; clientMsgId?: string },
): Promise<MessageRow> {
  let attachment: { filePath?: string; fileName?: string; fileType?: string } = {}
  if (input.file) attachment = await api.upload(input.file)
  const { message } = await api.send({
    channelId: input.channelId,
    content: input.content,
    parentId: input.parentId ?? null,
    clientMsgId: input.clientMsgId,
    ...attachment,
  })
  return message
}

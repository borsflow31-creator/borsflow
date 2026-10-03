// Pure naming helpers shared by the token route (server) and the chat UI (client).
// Deliberately free of any `ably` import so it is safe in both bundles.

/** Ably Chat room for one channel. The underlying Ably channel is `<room>::$chat`. */
export function chatRoomName(workspaceId: string, channelId: string) {
  return `ws:${workspaceId}:ch:${channelId}`
}

/** The Ably channel behind a chat room (Chat SDK convention). */
export function chatRoomChannel(workspaceId: string, channelId: string) {
  return `${chatRoomName(workspaceId, channelId)}::$chat`
}

/**
 * Workspace-wide signal channel: unread bumps, reactions, pins, thread replies,
 * channel list changes. Deliberately outside the `ws:` namespace so the room
 * capabilities never cover it; clients get subscribe-only access and only the
 * server publishes.
 */
export function chatSignalChannel(workspaceId: string) {
  return `chatsig:${workspaceId}`
}

/** Typing and presence need publish/presence; history lets the SDK recover after reconnects. */
export const CHAT_CAPABILITY_OPERATIONS = ['publish', 'subscribe', 'presence', 'history'] as const

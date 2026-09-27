// Pure naming helpers shared by the token route (server) and the chat UI (client).
// Deliberately free of any `ably` import so it is safe in both bundles.

/**
 * Ably Chat room for one channel. The underlying Ably channel is `<room>::$chat`, which the
 * workspace capability below covers via its trailing wildcard.
 */
export function chatRoomName(workspaceId: string, channelId: string) {
  return `ws:${workspaceId}:ch:${channelId}`
}

/** Capability resource for every room in a workspace. */
export function workspaceCapabilityKey(workspaceId: string) {
  return `ws:${workspaceId}:*`
}

export const CHAT_CAPABILITY_OPERATIONS = ['publish', 'subscribe', 'presence', 'history'] as const

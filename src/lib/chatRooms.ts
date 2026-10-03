// Pure naming helpers shared by the server (publishing) and the chat UI (subscribing).
// The RLS policies in the chat_supabase_realtime migration parse these exact
// formats, so change them together.

/** Supabase Realtime private topic for one chat channel: messages, typing, presence. */
export function chatRoomTopic(workspaceId: string, channelId: string) {
  return `chat:${workspaceId}:${channelId}`
}

/**
 * Workspace-wide signal topic: unread bumps, reactions, pins, thread replies,
 * channel list changes. Clients may only receive on it; only the server sends.
 */
export function chatSignalChannel(workspaceId: string) {
  return `chatsig:${workspaceId}`
}

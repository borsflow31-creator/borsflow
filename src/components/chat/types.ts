export interface ChatUser {
  id: string
  name: string | null
  email: string
}

/** Message as returned by the chat API (see presentMessage in src/lib/chat/server.ts). */
export interface MessageRow {
  id: string
  content: string
  userId: string
  workspaceId: string
  channelId: string | null
  parentId: string | null
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  pinnedAt: string | null
  pinnedById: string | null
  replyCount: number
  /** emoji -> user ids who reacted with it */
  reactions: Record<string, string[]>
  user: ChatUser
}

export interface Channel {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  createdAt: string
  createdById: string
  /** Private channels only */
  memberIds: string[]
  unreadCount: number
}

/** userId -> profile, built from the workspace owner + members. */
export type UserDirectory = Record<string, { name: string | null; email: string }>

/** What the current user may do in chat, returned by the channels endpoint. */
export interface ChatPermissions {
  canWrite: boolean
  canModerate: boolean
}

/** Payload of a channel topic's `message` broadcast (see ChatMessageEvent in src/lib/chat/server.ts). */
export interface RoomMessageEvent {
  kind: 'created' | 'updated' | 'deleted'
  message: MessageRow
  clientMsgId?: string
}

/** Unified view model for both API rows and live messages. */
export interface ChatItem {
  /** Stable React key: clientMsgId ?? id. Never changes once assigned. */
  key: string
  clientMsgId?: string
  /** Database id; present once the server has saved the message. */
  id?: string
  text: string
  userId: string
  displayName: string
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  createdAt: string
  editedAt?: string | null
  deletedAt?: string | null
  pinnedAt?: string | null
  replyCount?: number
  reactions?: Record<string, string[]>
  pending?: boolean
  failed?: boolean
}

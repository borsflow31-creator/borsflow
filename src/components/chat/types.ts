export interface ChatUser {
  id: string
  name: string | null
  email: string
}

/** Message row as returned by /api/workspaces/[id]/chat/messages (Prisma archive). */
export interface MessageRow {
  id: string
  content: string
  userId: string
  workspaceId: string
  channelId: string | null
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  ablySerial?: string | null
  createdAt: string
  user: ChatUser
}

export interface Channel {
  id: string
  name: string
  description: string | null
  createdAt: string
  createdById: string
  _count: { messages: number }
}

/** userId -> profile, built from the workspace owner + members. */
export type UserDirectory = Record<string, { name: string | null; email: string }>

/** Unified view model for both archived rows and live messages. */
export interface ChatItem {
  /** Stable React key: clientMsgId ?? serial ?? id. Never changes once assigned. */
  key: string
  clientMsgId?: string
  serial?: string
  id?: string
  text: string
  userId: string
  displayName: string
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  createdAt: string
  pending?: boolean
  archiveFailed?: boolean
}

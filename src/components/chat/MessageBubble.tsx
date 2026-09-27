'use client'

import { Download } from 'lucide-react'
import { formatTime, getFileIcon, getInitials } from './chatFormat'
import type { ChatItem } from './types'

function FilePreview({ message, isOwn }: { message: ChatItem; isOwn: boolean }) {
  if (!message.fileUrl) return null
  if (message.fileType?.startsWith('image/')) {
    return (
      <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.fileUrl}
          alt={message.fileName ?? 'image'}
          className="max-w-full max-h-52 rounded-xl object-cover mb-2 cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    )
  }
  return (
    <a
      href={message.fileUrl}
      download={message.fileName ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-2 transition-colors group ${
        isOwn ? 'bg-white/15 hover:bg-white/25' : 'bg-surface-container-highest hover:bg-outline-variant/20'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{getFileIcon(message.fileType)}</span>
      <span className="text-xs font-medium truncate max-w-[160px]">{message.fileName}</span>
      <Download className="h-3.5 w-3.5 ml-auto opacity-50 group-hover:opacity-100 flex-shrink-0" />
    </a>
  )
}

export function MessageBubble({
  message, isOwn, showAvatar, showName,
}: {
  message: ChatItem; isOwn: boolean; showAvatar: boolean; showName: boolean
}) {
  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div className="w-7 h-7 flex-shrink-0">
        {showAvatar && (
          <div className="w-7 h-7 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] font-bold text-secondary">
            {getInitials(message.displayName)}
          </div>
        )}
      </div>
      <div className={`max-w-[72%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
        {showName && !isOwn && (
          <span className="text-[11px] font-semibold text-on-surface-variant px-1">{message.displayName}</span>
        )}
        <div className={`px-4 py-2.5 text-sm shadow-sm ${
          isOwn
            ? 'bg-secondary text-on-secondary rounded-2xl rounded-br-sm'
            : 'bg-surface-container-high text-on-surface rounded-2xl rounded-bl-sm border border-outline-variant/10'
        }`}>
          <FilePreview message={message} isOwn={isOwn} />
          {message.text && <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>}
        </div>
        <span className={`text-[10px] text-on-surface-variant/50 px-1 ${isOwn ? 'text-right' : ''}`}>
          {formatTime(message.createdAt)}
          {message.archiveFailed && <span className="ml-1.5 text-amber-500" title="Delivered live but not saved to history">· not saved</span>}
        </span>
      </div>
    </div>
  )
}

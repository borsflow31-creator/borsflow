import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getSupabaseAdmin, CHAT_BUCKET } from '@/lib/supabase-admin'
import { CHAT_FILE_TYPES, MAX_FILE_SIZE, chatRateLimit, getChatAccess } from '@/lib/chat/server'

/**
 * The browser-declared MIME type is just a claim; check the first bytes match it
 * so a renamed executable or HTML file can't ride in as a "PDF" or "image".
 */
function contentMatchesType(bytes: Uint8Array, type: string): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  switch (CHAT_FILE_TYPES[type]) {
    case 'jpg': return starts(0xff, 0xd8, 0xff)
    case 'png': return starts(0x89, 0x50, 0x4e, 0x47)
    case 'gif': return starts(0x47, 0x49, 0x46, 0x38)
    case 'webp': return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    case 'pdf': return starts(0x25, 0x50, 0x44, 0x46)
    case 'zip':
    case 'docx':
    case 'xlsx': return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06)
    case 'doc':
    case 'xls': return starts(0xd0, 0xcf, 0x11, 0xe0)
    case 'txt':
    case 'csv': return !bytes.slice(0, 8192).includes(0) // text has no NUL bytes
    default: return false
  }
}

// POST /api/workspaces/[id]/chat/upload  (multipart: file)
// Stores the file in the private chat bucket and returns its path. The message
// that references it is what grants access (see /chat/files/[messageId]).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const result = await getChatAccess(params.id, { write: true })
  if ('error' in result) return result.error
  const { access } = result

  let file: File | null = null
  try {
    file = (await request.formData()).get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 })
  }
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  const ext = CHAT_FILE_TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })

  const limited = await chatRateLimit('upload', access.userId)
  if (limited) return limited

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!contentMatchesType(new Uint8Array(buffer), file.type)) {
    return NextResponse.json({ error: "The file's contents don't match its type" }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error('[chat/upload] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
    return NextResponse.json({ error: 'File uploads are not configured' }, { status: 500 })
  }

  const filePath = `${params.id}/${randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: false })
  if (error) {
    console.error('[chat/upload] storage upload failed:', error.message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  return NextResponse.json({ filePath, fileName: file.name.slice(0, 255), fileType: file.type })
}

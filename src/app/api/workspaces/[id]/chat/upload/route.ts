import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getSupabaseAdmin, CHAT_BUCKET } from '@/lib/supabase-admin'

// Extension is derived from the validated MIME type, never from the client's
// filename, so an upload can't be served back as HTML/SVG from our storage.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
}
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: params.id,
      OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    console.error('[chat/upload] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
    return NextResponse.json({ error: 'File uploads are not configured' }, { status: 500 })
  }

  const objectPath = `${workspace.id}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(objectPath, buffer, { contentType: file.type, upsert: false })
  if (error) {
    console.error('[chat/upload] storage upload failed:', error.message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(objectPath)

  return NextResponse.json({
    fileUrl: data.publicUrl,
    fileName: file.name,
    fileType: file.type,
  })
}

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin';
import { consumeRateLimits, rateLimitedResponse } from '@/lib/api/rate-limit';
import { CRM_EXTRA_FILE_TYPES, MAX_UPLOAD_SIZE, UPLOAD_FILE_TYPES, contentMatchesType } from '@/lib/uploads';
import { getLeadAccess } from '@/lib/crm/lead-access';
import { CrmLogger } from '@/lib/crm/logger';

const ALLOWED_TYPES = { ...UPLOAD_FILE_TYPES, ...CRM_EXTRA_FILE_TYPES };
const MAX_FILES_PER_LEAD = 200;
const UPLOAD_LIMIT = { bucket: 'crm:file', limit: 60, windowMs: 60 * 60 * 1000, windowLabel: 'hour' };

const fileSelect = {
  id: true,
  fileName: true,
  fileType: true,
  size: true,
  createdAt: true,
  uploadedById: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
} as const;

// GET /api/leads/[id]/files — the prospect's files, newest first
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const result = await getLeadAccess(params.id);
  if ('error' in result) return result.error;
  const { access } = result;

  const files = await prisma.leadFile.findMany({
    where: { leadId: params.id },
    orderBy: { createdAt: 'desc' },
    select: fileSelect,
  });

  return NextResponse.json({
    files,
    canWrite: access.role !== 'viewer',
    canModerate: access.canModerate,
  });
}

// POST /api/leads/[id]/files  (multipart: file)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const result = await getLeadAccess(params.id, { write: true });
  if ('error' in result) return result.error;
  const { access } = result;

  let file: File | null = null;
  try {
    const entry = (await request.formData()).get('file');
    file = entry && typeof entry !== 'string' ? entry : null;
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: 'The file is empty' }, { status: 400 });
  if (file.size > MAX_UPLOAD_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'This file type is not allowed' }, { status: 400 });

  const count = await prisma.leadFile.count({ where: { leadId: params.id } });
  if (count >= MAX_FILES_PER_LEAD) {
    return NextResponse.json({ error: `A prospect can have at most ${MAX_FILES_PER_LEAD} files` }, { status: 400 });
  }

  const limit = await consumeRateLimits([{ subject: `user:${access.userId}`, rule: UPLOAD_LIMIT }]);
  if (!limit.allowed) return rateLimitedResponse(limit, 1, { noun: 'file upload', verb: 'make' });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!contentMatchesType(new Uint8Array(buffer), ext)) {
    return NextResponse.json({ error: "The file's contents don't match its type" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[crm/files] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json({ error: 'File uploads are not configured' }, { status: 500 });
  }

  const filePath = `crm/${access.workspaceId}/${params.id}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(CRM_BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: false });
  if (error) {
    console.error('[crm/files] storage upload failed:', error.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const saved = await prisma.leadFile.create({
    data: {
      leadId: params.id,
      workspaceId: access.workspaceId,
      filePath,
      fileName: file.name.slice(0, 255) || `file.${ext}`,
      fileType: file.type,
      size: file.size,
      uploadedById: access.userId,
    },
    select: fileSelect,
  });

  await CrmLogger.logFile({
    workspaceId: access.workspaceId,
    userId: access.userId,
    leadId: params.id,
    fileId: saved.id,
    fileName: saved.fileName,
    fileType: saved.fileType,
    size: saved.size,
    action: 'added',
  });

  return NextResponse.json({ file: saved }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin';
import { getLeadAccess } from '@/lib/crm/lead-access';
import { CrmLogger } from '@/lib/crm/logger';
import { canViewDocument, isDocumentVisibility } from '@/lib/crm/document-access';

type Params = { params: { id: string; fileId: string } };

// Long enough for a slow download, short enough that a copied link soon dies.
const SIGNED_URL_TTL_SECONDS = 5 * 60;
// Only these open inline in the browser; everything else is downloaded.
const INLINE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

// GET /api/leads/[id]/files/[fileId]  (?inline=1 to preview instead of download)
// Members who can see the prospect are redirected to a short-lived signed URL.
export async function GET(request: NextRequest, { params }: Params) {
  const result = await getLeadAccess(params.id);
  if ('error' in result) return result.error;

  const file = await prisma.leadFile.findFirst({
    where: { id: params.fileId, leadId: params.id },
    select: { filePath: true, fileName: true, fileType: true, visibility: true },
  });
  // 404, not 403: a file you may not see should look the same as one that is not there.
  if (!file || !canViewDocument(result.access.canModerate, file.visibility)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'File storage is not configured' }, { status: 500 });

  const inline = request.nextUrl.searchParams.get('inline') === '1' && INLINE_TYPES.includes(file.fileType);
  const { data, error } = await supabase.storage
    .from(CRM_BUCKET)
    .createSignedUrl(file.filePath, SIGNED_URL_TTL_SECONDS, inline ? undefined : { download: file.fileName });
  if (error || !data?.signedUrl) {
    console.error('[crm/files] signed URL failed:', error?.message);
    return NextResponse.json({ error: 'File unavailable' }, { status: 502 });
  }

  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } });
}

// DELETE /api/leads/[id]/files/[fileId]
// The uploader can delete their file; the owner and admins can delete any.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const result = await getLeadAccess(params.id, { write: true });
  if ('error' in result) return result.error;
  const { access } = result;

  const file = await prisma.leadFile.findFirst({ where: { id: params.fileId, leadId: params.id } });
  // Checked before the uploader rule: someone who uploaded a file and has since lost
  // their admin role does not keep the right to delete what is now managers-only.
  if (!file || !canViewDocument(access.canModerate, file.visibility)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
  if (file.uploadedById !== access.userId && !access.canModerate) {
    return NextResponse.json({ error: 'Only the person who uploaded this file or an admin can delete it' }, { status: 403 });
  }

  await prisma.leadFile.delete({ where: { id: file.id } });
  const { error } = (await getSupabaseAdmin()?.storage.from(CRM_BUCKET).remove([file.filePath])) ?? { error: null };
  if (error) console.error('[crm/files] storage delete failed:', error.message);

  await CrmLogger.logFile({
    workspaceId: access.workspaceId,
    userId: access.userId,
    leadId: params.id,
    fileId: file.id,
    fileName: file.fileName,
    fileType: file.fileType,
    size: file.size,
    action: 'deleted',
    visibility: file.visibility,
  });

  return NextResponse.json({ success: true });
}

// PATCH /api/leads/[id]/files/[fileId]  { visibility: 'team' | 'managers' }
// Owners and admins decide who can see a file.
export async function PATCH(request: NextRequest, { params }: Params) {
  const result = await getLeadAccess(params.id, { write: true });
  if ('error' in result) return result.error;
  if (!result.access.canModerate) {
    return NextResponse.json({ error: 'Only an owner or admin can change who can see a file' }, { status: 403 });
  }

  let body: { visibility?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!isDocumentVisibility(body.visibility)) {
    return NextResponse.json({ error: 'Visibility must be team or managers' }, { status: 400 });
  }

  const updated = await prisma.leadFile.updateMany({
    where: { id: params.fileId, leadId: params.id },
    data: { visibility: body.visibility },
  });
  if (updated.count === 0) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  return NextResponse.json({ success: true, visibility: body.visibility });
}

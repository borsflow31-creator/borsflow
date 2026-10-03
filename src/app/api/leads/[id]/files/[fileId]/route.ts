import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin, CRM_BUCKET } from '@/lib/supabase-admin';
import { getLeadAccess } from '@/lib/crm/lead-access';
import { CrmLogger } from '@/lib/crm/logger';

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
    select: { filePath: true, fileName: true, fileType: true },
  });
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

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
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });
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
  });

  return NextResponse.json({ success: true });
}

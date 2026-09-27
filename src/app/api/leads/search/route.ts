import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/leads/search?workspaceId=...&q=...
 * Search leads across all pipelines in a workspace by name, email, company, or phone.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const q = (searchParams.get('q') || '').trim();

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  // Verify workspace access
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
  });
  if (!workspace) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const leads = await prisma.lead.findMany({
    where: {
      pipeline: { workspaceId },
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName:  { contains: q, mode: 'insensitive' } },
              { email:     { contains: q, mode: 'insensitive' } },
              { company:   { contains: q, mode: 'insensitive' } },
              { phone:     { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      company: true,
    },
    take: 20,
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  return NextResponse.json({ leads });
}

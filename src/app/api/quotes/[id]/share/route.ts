import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditContent, READ_ONLY_ERROR } from '@/lib/api/workspace';
import { shareDocument } from '@/lib/documents/share';

// POST /api/quotes/[id]/share - mint or rotate the public client link
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { workspaceId: true },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: quote.workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Membership is not enough to change content: viewers are read-only.
    if (!(await canEditContent(workspace.id, session.user.id))) {
      return NextResponse.json({ error: READ_ONLY_ERROR }, { status: 403 });
    }

    // `rotate` issues a fresh token, which is what revokes a link already sent.
    const body = await request.json().catch(() => ({}));
    const { token, url } = await shareDocument('quote', params.id, { rotate: body.rotate === true });

    return NextResponse.json({ token, url });
  } catch (error) {
    console.error('Error sharing quote:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}

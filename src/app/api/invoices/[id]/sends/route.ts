import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listDocumentSends } from '@/lib/documents/send-email';

// GET /api/invoices/[id]/sends - who sent this invoice, to whom, from which address, and when
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { workspaceId: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: invoice.workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const sends = await listDocumentSends('invoice', params.id, workspace.id);
    return NextResponse.json({ sends });
  } catch (error) {
    console.error('Error fetching invoice sends:', error);
    return NextResponse.json({ error: 'Failed to fetch send history' }, { status: 500 });
  }
}

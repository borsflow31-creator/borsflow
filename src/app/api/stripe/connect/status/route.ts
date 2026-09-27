export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAccountStatus } from '@/lib/stripe';

// GET /api/stripe/connect/status?workspaceId=xxx
// Returns the Stripe Connect status for the workspace.
// Also syncs stripeAccountEnabled to the DB if it changed.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      select: { stripeAccountId: true, stripeAccountEnabled: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!workspace.stripeAccountId) {
      return NextResponse.json({ connected: false, chargesEnabled: false });
    }

    const status = await getAccountStatus(workspace.stripeAccountId);

    // Sync to DB if enabled state changed
    if (status.chargesEnabled !== workspace.stripeAccountEnabled) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { stripeAccountEnabled: status.chargesEnabled },
      });
    }

    return NextResponse.json({
      connected: true,
      chargesEnabled: status.chargesEnabled,
      detailsSubmitted: status.detailsSubmitted,
    });
  } catch (error) {
    console.error('Stripe Connect status error:', error);
    return NextResponse.json({ error: 'Failed to get Stripe status' }, { status: 500 });
  }
}

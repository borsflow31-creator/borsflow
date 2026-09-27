import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createLoginLink } from '@/lib/stripe';

// POST /api/stripe/connect/login-link
// Generates a Stripe Express dashboard login link for the workspace owner.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await request.json();
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    // Only the owner can access the Stripe dashboard
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: session.user.id },
      select: { stripeAccountId: true, stripeAccountEnabled: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!workspace.stripeAccountId || !workspace.stripeAccountEnabled) {
      return NextResponse.json({ error: 'Stripe account not connected or not fully onboarded' }, { status: 400 });
    }

    const loginUrl = await createLoginLink(workspace.stripeAccountId);
    return NextResponse.json({ loginUrl });
  } catch (error) {
    console.error('Stripe login link error:', error);
    return NextResponse.json({ error: 'Failed to generate login link' }, { status: 500 });
  }
}

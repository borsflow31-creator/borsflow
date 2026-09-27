import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createConnectAccount, createAccountLink, getAccountStatus } from '@/lib/stripe';

// POST /api/stripe/connect
// Starts Stripe Connect onboarding for a workspace.
// If the workspace already has a connected account that isn't fully onboarded,
// it generates a fresh account link. Otherwise it creates a new account.
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

    // Only the workspace owner can connect Stripe
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: session.user.id },
    });
    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let accountId = workspace.stripeAccountId;

    if (accountId) {
      // Check if already fully enabled — nothing to do
      const status = await getAccountStatus(accountId);
      if (status.chargesEnabled) {
        return NextResponse.json({ alreadyConnected: true });
      }
    } else {
      // Create a new Express account
      const ownerEmail = session.user.email ?? '';
      accountId = await createConnectAccount(ownerEmail);
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { stripeAccountId: accountId, stripeAccountEnabled: false },
      });
    }

    const onboardingUrl = await createAccountLink(accountId, workspaceId);
    return NextResponse.json({ onboardingUrl });
  } catch (error) {
    console.error('Stripe Connect error:', error);
    return NextResponse.json({ error: 'Failed to start Stripe Connect' }, { status: 500 });
  }
}

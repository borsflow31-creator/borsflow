import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { requireWorkspacePermission } from '@/lib/api/workspace';

// GET /api/stripe/settings?workspaceId=...
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
      select: {
        stripeSecretKey: true,
        stripePublishableKey: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Return masked info only — never expose the full secret key
    let secretKeyLast4: string | null = null;
    if (workspace.stripeSecretKey) {
      try {
        const decrypted = decrypt(workspace.stripeSecretKey);
        secretKeyLast4 = decrypted.slice(-4);
      } catch {
        secretKeyLast4 = '????';
      }
    }

    return NextResponse.json({
      hasSecretKey: !!workspace.stripeSecretKey,
      secretKeyLast4,
      hasPublishableKey: !!workspace.stripePublishableKey,
      publishableKey: workspace.stripePublishableKey ?? null,
      // Signal to invoices page that direct keys are configured
      directKeysEnabled: !!(workspace.stripeSecretKey && workspace.stripePublishableKey),
    });
  } catch (error) {
    console.error('Error fetching Stripe settings:', error);
    return NextResponse.json({ error: 'Failed to fetch Stripe settings' }, { status: 500 });
  }
}

// POST /api/stripe/settings
// Body: { workspaceId, secretKey?, publishableKey?, clear? }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, secretKey, publishableKey, clear } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    // These keys decide whose Stripe account receives the workspace's payments,
    // so only an owner or admin may set or clear them. This used to accept any
    // member, including viewers, who could point payment links at their own account.
    const access = await requireWorkspacePermission(workspaceId, 'workspace:write');
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (clear) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          stripeSecretKey: null,
          stripePublishableKey: null,
        },
      });
      return NextResponse.json({ success: true, message: 'Stripe keys cleared' });
    }

    // Validate keys look right before saving
    if (secretKey && !secretKey.startsWith('sk_')) {
      return NextResponse.json({ error: 'Secret key must start with sk_live_ or sk_test_' }, { status: 400 });
    }
    if (publishableKey && !publishableKey.startsWith('pk_')) {
      return NextResponse.json({ error: 'Publishable key must start with pk_live_ or pk_test_' }, { status: 400 });
    }

    const updateData: Record<string, string | null> = {};
    if (secretKey) {
      updateData.stripeSecretKey = encrypt(secretKey);
    }
    if (publishableKey) {
      updateData.stripePublishableKey = publishableKey; // public key stored as-is
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No keys provided' }, { status: 400 });
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
    });

    return NextResponse.json({ success: true, message: 'Stripe keys saved' });
  } catch (error) {
    console.error('Error saving Stripe settings:', error);
    return NextResponse.json({ error: 'Failed to save Stripe settings' }, { status: 500 });
  }
}

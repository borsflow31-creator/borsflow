import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolvePrefs, parsePrefsInput } from '@/lib/notifications/prefs';

/** GET /api/user/notification-prefs — the resolved per-category matrix plus the master email switch. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notificationsEmail: true, notificationPrefs: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      notificationsEmail: user.notificationsEmail,
      prefs: resolvePrefs(user.notificationPrefs),
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch notification preferences' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/notification-prefs
 * Body: `{ notificationsEmail?: boolean, prefs?: { [category]: { inApp?: boolean, email?: boolean } } }`
 * `prefs` is merged onto the current per-category settings field by field, so
 * sending only `{ sales: { email: false } }` never resets `sales.inApp`.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { notificationsEmail, prefs: prefsInput } = body as {
      notificationsEmail?: unknown;
      prefs?: unknown;
    };

    if (notificationsEmail !== undefined && typeof notificationsEmail !== 'boolean') {
      return NextResponse.json({ error: 'notificationsEmail must be a boolean' }, { status: 400 });
    }

    let nextPrefs: ReturnType<typeof resolvePrefs> | undefined;
    if (prefsInput !== undefined) {
      const parsed = parsePrefsInput(prefsInput);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid prefs payload' }, { status: 400 });
      }

      const current = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { notificationPrefs: true },
      });
      const resolved = resolvePrefs(current?.notificationPrefs);
      for (const [category, override] of Object.entries(parsed)) {
        resolved[category as keyof typeof resolved] = {
          ...resolved[category as keyof typeof resolved],
          ...override,
        };
      }
      nextPrefs = resolved;
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(notificationsEmail !== undefined && { notificationsEmail }),
        ...(nextPrefs !== undefined && { notificationPrefs: nextPrefs as unknown as Prisma.InputJsonValue }),
      },
      select: { notificationsEmail: true, notificationPrefs: true },
    });

    return NextResponse.json({
      notificationsEmail: updated.notificationsEmail,
      prefs: resolvePrefs(updated.notificationPrefs),
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json({ error: 'Failed to update notification preferences' }, { status: 500 });
  }
}

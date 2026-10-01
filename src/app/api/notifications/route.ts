import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;

/**
 * GET /api/notifications?cursor=<id>&unreadOnly=true
 * A page of the caller's own notifications, newest first, plus the unread count
 * (which the bell polls independently of pagination).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where = {
      userId: session.user.id,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: PAGE_SIZE + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
    ]);

    const hasMore = notifications.length > PAGE_SIZE;
    const page = hasMore ? notifications.slice(0, PAGE_SIZE) : notifications;

    return NextResponse.json({
      notifications: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Body: `{ ids: string[] }` marks specific notifications read, `{ all: true }`
 * marks every unread notification read. Scoped to the caller's own rows.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { ids, all } = body as { ids?: unknown; all?: unknown };

    if (all === true) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string') || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array of strings, or pass { all: true }' }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where: { id: { in: ids as string[] }, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}

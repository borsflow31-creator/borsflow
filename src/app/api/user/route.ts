import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, theme, notificationsEmail, notificationsPush } = body;

        // Any string used to be stored as the theme, which the UI then can't apply.
        if (theme !== undefined && !['light', 'dark', 'system'].includes(theme)) {
            return NextResponse.json({ error: 'Theme must be light, dark or system' }, { status: 400 });
        }

        // Update user in database
        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                ...(name && { name }),
                ...(theme && { theme }),
                ...(notificationsEmail !== undefined && { notificationsEmail }),
                ...(notificationsPush !== undefined && { notificationsPush }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                theme: true,
                notificationsEmail: true,
                notificationsPush: true,
            },
        });

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json(
            { error: 'Failed to update user' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                theme: true,
                notificationsEmail: true,
                notificationsPush: true,
                createdAt: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user' },
            { status: 500 }
        );
    }
}

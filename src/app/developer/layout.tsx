'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

/**
 * The developer screens are for developer accounts. The sidebar already hides
 * them from agencies; this sends an agency that opens one by URL back to its
 * dashboard. An account that has not chosen yet (null) is left alone: the
 * business-type popup in AppShell asks it first.
 */
export default function DeveloperLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const businessType = session?.user?.businessType;
    const isOtherBusiness = status === 'authenticated' && !!businessType && businessType !== 'DEVELOPER';

    useEffect(() => {
        if (isOtherBusiness) router.replace('/dashboard');
    }, [isOtherBusiness, router]);

    if (isOtherBusiness) return null;
    return <>{children}</>;
}

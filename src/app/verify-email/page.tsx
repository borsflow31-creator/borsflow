'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('No verification token found.');
            return;
        }

        const verify = async () => {
            try {
                const res = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (res.ok) {
                    setStatus('success');
                    setMessage('Your email has been verified successfully!');
                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 2000);
                } else {
                    setStatus('error');
                    setMessage(data.error || 'Failed to verify email.');
                }
            } catch (err) {
                setStatus('error');
                setMessage('An unexpected error occurred.');
            }
        };

        verify();
    }, [token, router]);

    return (
        <div className="w-full max-w-md text-center bg-surface-container-low rounded-xl p-8 shadow-lg">
            <div className="mb-6 flex justify-center">
                {status === 'loading' && <Loader2 className="h-16 w-16 text-secondary animate-spin" />}
                {status === 'success' && <CheckCircle className="h-16 w-16 text-success" />}
                {status === 'error' && <AlertCircle className="h-16 w-16 text-error" />}
            </div>
            
            <h1 className="text-3xl font-bold text-on-surface mb-4">
                {status === 'loading' ? 'Verifying...' : status === 'success' ? 'Verified!' : 'Verification Failed'}
            </h1>
            
            <p className="text-on-surface-variant mb-8 text-lg">
                {message}
            </p>

            {status === 'success' && (
                <p className="text-sm text-on-surface-variant animate-pulse">
                    Redirecting you to the dashboard...
                </p>
            )}

            {status === 'error' && (
                <Link
                    href="/login"
                    className="inline-flex items-center justify-center px-6 py-3 bg-secondary text-on-secondary rounded-lg font-medium hover:bg-secondary-dim transition-colors"
                >
                    Back to Login
                </Link>
            )}
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
            <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary mx-auto"></div>}>
                <VerifyEmailContent />
            </Suspense>
        </div>
    );
}

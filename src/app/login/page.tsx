'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Layers } from 'lucide-react';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    // Honour ?callbackUrl= so flows that route through login (e.g. an emailed
    // workspace invitation) return to where they started. Relative paths only,
    // so the parameter can't be used as an open redirect.
    const rawCallbackUrl = searchParams.get('callbackUrl');
    const callbackUrl =
        rawCallbackUrl && rawCallbackUrl.startsWith('/') && !rawCallbackUrl.startsWith('//')
            ? rawCallbackUrl
            : '/dashboard';
    const { data: session, status } = useSession();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (status === 'authenticated') {
            router.replace(callbackUrl);
        }
    }, [status, router, callbackUrl]);

    if (status === 'loading' || status === 'authenticated') return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
            } else if (result?.ok) {
                router.push(callbackUrl);
                router.refresh();
            }
        } catch (error) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const field =
        'w-full px-4 py-3 rounded-xl bg-[var(--n-elevated)] border border-[var(--n-border)] text-sm text-[var(--n-text)] placeholder:text-[var(--n-muted)] transition-colors hover:border-[var(--n-border-strong)] focus:border-[var(--n-emerald)] disabled:opacity-50';

    return (
        <main className="landing-surface min-h-screen flex flex-col items-center justify-center px-5 py-16 bg-[var(--n-base)] text-[var(--n-text)]">
            <div className="w-full max-w-md">
                <Link href="/" className="inline-flex items-center gap-2.5 group">
                    <span className="w-8 h-8 rounded-lg bg-[var(--n-text)] text-[var(--n-base)] flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
                        <Layers className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span className="font-display text-base font-semibold tracking-tight">BorsFlow</span>
                </Link>

                <h1 className="mt-10 font-display t-sub text-[var(--n-text)]">Welcome back.</h1>
                <p className="mt-2 text-sm text-[var(--n-muted)]">
                    Sign in to pick up where your pipeline left off.
                </p>

                <div className="mt-8 taste-plinth p-6 sm:p-8">
                    {error && (
                        /* No second hue: the system allows the emerald or a hairline,
                           and meaning is carried by the icon and the strong rule
                           rather than by colour alone. */
                        <div
                            role="alert"
                            className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-[var(--n-elevated)] border border-[var(--n-border-strong)]"
                        >
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--n-text)]" aria-hidden="true" />
                            <p className="text-sm text-[var(--n-text)]">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="block mb-2 text-xs font-medium text-[var(--n-text)]">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className={field}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block mb-2 text-xs font-medium text-[var(--n-text)]">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className={field}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !email || !password}
                            className="taste-btn-primary w-full px-5 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <span
                                        className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"
                                        aria-hidden="true"
                                    />
                                    <span>Signing in…</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign in</span>
                                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-4">
                        <span className="h-px flex-1 bg-[var(--n-border)]" />
                        <span className="text-xs text-[var(--n-muted)]">or</span>
                        <span className="h-px flex-1 bg-[var(--n-border)]" />
                    </div>

                    <button
                        type="button"
                        onClick={() => signIn('google', { callbackUrl })}
                        className="taste-btn-ghost w-full px-5 py-3 text-sm"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l2.85-2.22.83-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        <span>Continue with Google</span>
                    </button>
                </div>

                <p className="mt-6 text-center text-sm text-[var(--n-muted)]">
                    No account yet?{' '}
                    <Link
                        href={
                            callbackUrl === '/dashboard'
                                ? '/register'
                                : `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
                        }
                        className="text-[var(--n-text)] underline underline-offset-4 decoration-[var(--n-border-strong)] hover:decoration-[var(--n-text)] transition-colors"
                    >
                        Create one
                    </Link>
                </p>
            </div>
        </main>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}

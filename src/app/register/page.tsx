'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Layers, MailCheck } from 'lucide-react';

function RegisterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    // Preserve ?callbackUrl= across sign-up so an invited user lands back on
    // their invitation after logging in. Relative paths only (no open redirect).
    const rawCallbackUrl = searchParams.get('callbackUrl');
    const callbackUrl =
        rawCallbackUrl && rawCallbackUrl.startsWith('/') && !rawCallbackUrl.startsWith('//')
            ? rawCallbackUrl
            : null;
    const loginHref = callbackUrl
        ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : '/login';
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const validateForm = () => {
        if (!name.trim()) {
            setError('Name is required');
            return false;
        }
        if (!email.trim()) {
            setError('Email is required');
            return false;
        }
        if (!password) {
            setError('Password is required');
            return false;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return false;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Registration failed');
            } else {
                setSuccess(true);
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    router.push(loginHref);
                }, 2000);
            }
        } catch (error) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const field =
        'w-full px-4 py-3 rounded-xl bg-[var(--n-elevated)] border border-[var(--n-border)] text-sm text-[var(--n-text)] placeholder:text-[var(--n-muted)] transition-colors hover:border-[var(--n-border-strong)] focus:border-[var(--n-emerald)] disabled:opacity-50';

    if (success) {
        return (
            <main className="landing-surface min-h-screen flex items-center justify-center px-5 py-16 bg-[var(--n-base)] text-[var(--n-text)]">
                <div className="w-full max-w-md text-center">
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--n-emerald-dim)]">
                        <MailCheck className="w-5 h-5 text-[var(--n-emerald)]" aria-hidden="true" />
                    </span>
                    {/* Verification is mandatory: sign-in refuses an unverified
                        address, so saying "redirecting to login" on its own would
                        send people straight into a wall. */}
                    <h1 className="mt-6 font-display t-sub text-[var(--n-text)]">Check your email.</h1>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                        We sent a verification link to{' '}
                        <span className="text-[var(--n-text)]">{email}</span>. You will need it before your first sign-in.
                    </p>
                    <p className="mt-6 text-xs text-[var(--n-muted)]">Taking you to sign-in…</p>
                </div>
            </main>
        );
    }

    return (
        <main className="landing-surface min-h-screen flex flex-col items-center justify-center px-5 py-16 bg-[var(--n-base)] text-[var(--n-text)]">
            <div className="w-full max-w-md">
                <Link href="/" className="inline-flex items-center gap-2.5 group">
                    <span className="w-8 h-8 rounded-lg bg-[var(--n-text)] text-[var(--n-base)] flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105">
                        <Layers className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span className="font-display text-base font-semibold tracking-tight">BorsFlow</span>
                </Link>

                <h1 className="mt-10 font-display t-sub text-[var(--n-text)]">Create a workspace.</h1>
                <p className="mt-2 text-sm text-[var(--n-muted)]">
                    Add a lead, write the scope, send the quote. About ten minutes.
                </p>

                <div className="mt-8 taste-plinth p-6 sm:p-8">
                    {error && (
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
                            <label htmlFor="name" className="block mb-2 text-xs font-medium text-[var(--n-text)]">
                                Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                autoComplete="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Avery Cole"
                                className={field}
                                required
                                disabled={isLoading}
                            />
                        </div>

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
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                className={field}
                                required
                                minLength={8}
                                disabled={isLoading}
                                aria-describedby="password-hint"
                            />
                            <p id="password-hint" className="mt-2 text-xs text-[var(--n-muted)]">
                                Eight characters or more.
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block mb-2 text-xs font-medium text-[var(--n-text)]"
                            >
                                Confirm password
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className={field}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="taste-btn-primary w-full px-5 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <span
                                        className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"
                                        aria-hidden="true"
                                    />
                                    <span>Creating…</span>
                                </>
                            ) : (
                                <>
                                    <span>Create workspace</span>
                                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="mt-6 text-center text-sm text-[var(--n-muted)]">
                    Already have an account?{' '}
                    <Link
                        href={loginHref}
                        className="text-[var(--n-text)] underline underline-offset-4 decoration-[var(--n-border-strong)] hover:decoration-[var(--n-text)] transition-colors"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </main>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={null}>
            <RegisterContent />
        </Suspense>
    );
}

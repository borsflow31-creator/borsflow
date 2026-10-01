'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { AlertCircle, ArrowRight, Layers, MailCheck } from 'lucide-react';
import { safeCallbackUrl } from '@/lib/url';
import { useI18n } from '@/i18n/I18nProvider';

function RegisterContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n();
    // Preserve ?callbackUrl= across sign-up so an invited user lands back on
    // their invitation after logging in. Relative paths only (no open redirect).
    const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'), null);
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
            setError(t('auth.nameRequired'));
            return false;
        }
        if (!email.trim()) {
            setError(t('auth.emailRequired'));
            return false;
        }
        if (!password) {
            setError(t('auth.passwordRequired'));
            return false;
        }
        if (password.length < 8) {
            setError(t('auth.passwordTooShort'));
            return false;
        }
        if (password !== confirmPassword) {
            setError(t('auth.passwordMismatch'));
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
                    // So the verification link returns here, not to the dashboard.
                    callbackUrl,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || t('auth.registrationFailed'));
            } else {
                setSuccess(true);
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    router.push(loginHref);
                }, 2000);
            }
        } catch (error) {
            setError(t('common.errorRetry'));
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
                    <h1 className="mt-6 font-display t-sub text-[var(--n-text)]">{t('auth.checkEmailTitle')}</h1>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--n-muted)]">
                        {t('auth.checkEmailBody', { email })}
                    </p>
                    <p className="mt-6 text-xs text-[var(--n-muted)]">{t('auth.takingYouToSignIn')}</p>
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
                    <span className="font-display text-base font-semibold tracking-tight">{t('misc.brandName')}</span>
                </Link>

                <h1 className="mt-10 font-display t-sub text-[var(--n-text)]">{t('auth.registerTitle')}</h1>
                <p className="mt-2 text-sm text-[var(--n-muted)]">
                    {t('auth.registerSubtitle')}
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
                                {t('auth.name')}
                            </label>
                            <input
                                id="name"
                                type="text"
                                autoComplete="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('misc.demoName')}
                                className={field}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block mb-2 text-xs font-medium text-[var(--n-text)]">
                                {t('auth.email')}
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
                                {t('auth.password')}
                            </label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('auth.passwordPlaceholder')}
                                className={field}
                                required
                                minLength={8}
                                disabled={isLoading}
                                aria-describedby="password-hint"
                            />
                            <p id="password-hint" className="mt-2 text-xs text-[var(--n-muted)]">
                                {t('auth.passwordHint')}
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block mb-2 text-xs font-medium text-[var(--n-text)]"
                            >
                                {t('auth.confirmPassword')}
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
                                    <span>{t('auth.creatingWorkspace')}</span>
                                </>
                            ) : (
                                <>
                                    <span>{t('auth.createWorkspace')}</span>
                                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-4">
                        <span className="h-px flex-1 bg-[var(--n-border)]" />
                        <span className="text-xs text-[var(--n-muted)]">{t('common.or')}</span>
                        <span className="h-px flex-1 bg-[var(--n-border)]" />
                    </div>

                    {/* Same button as the login page. Google accounts arrive
                        verified, and the signIn callback in lib/auth creates the
                        user and their starter workspace on first use - so this
                        skips the verification email entirely. */}
                    <button
                        type="button"
                        onClick={() => signIn('google', { callbackUrl: callbackUrl ?? '/dashboard' })}
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
                        <span>{t('auth.signUpWithGoogle')}</span>
                    </button>
                </div>

                <p className="mt-6 text-center text-sm text-[var(--n-muted)]">
                    {t('auth.hasAccount')}{' '}
                    <Link
                        href={loginHref}
                        className="text-[var(--n-text)] underline underline-offset-4 decoration-[var(--n-border-strong)] hover:decoration-[var(--n-text)] transition-colors"
                    >
                        {t('auth.signIn')}
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

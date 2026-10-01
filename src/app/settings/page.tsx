'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAppStore } from '@/store/appStore'
import Toast from '@/components/Toast'
import { PlanUsageSettings } from '@/components/billing/PlanUsageSettings'
import NotificationSettings from '@/components/settings/NotificationSettings'
import { useI18n } from '@/i18n/I18nProvider'
import {
    User, Bell, Shield, Palette, Check, X, Save,
    Loader2, CheckCircle,
    Plug, Calendar, Video, CreditCard, RefreshCw, Trash2
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalendarIntegration {
    id: string
    type: string
    name: string
    providerEmail: string
    lastSyncAt: string | null
    syncStatus: string
    syncFrequency: string
}

interface VideoConfig {
    id: string
    platform: string
    name: string
    providerEmail: string
    isDefault: boolean
}

function SettingsPageInner() {
    const { data: session, status, update } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { theme, setTheme, currentWorkspaceId } = useAppStore()
    const { t } = useI18n()

    const validSections = ['profile', 'notifications', 'appearance', 'security', 'integrations', 'billing']
    const sectionParam = searchParams.get('section')
    const [activeSection, setActiveSection] = useState(
        sectionParam && validSections.includes(sectionParam) ? sectionParam : 'profile'
    )
    const [isLoading, setIsLoading] = useState(false)
    const [showToast, setShowToast] = useState(false)
    const [toastMessage, setToastMessage] = useState('')
    const [toastType, setToastType] = useState<'success' | 'error'>('success')

    // Profile state
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')

    // Password state
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')

    // Integrations state
    const [calendarIntegrations, setCalendarIntegrations] = useState<CalendarIntegration[]>([])
    const [videoConfigs, setVideoConfigs] = useState<VideoConfig[]>([])
    const [integrationsLoading, setIntegrationsLoading] = useState(false)
    const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        }
    }, [status, router])

    useEffect(() => {
        if (session?.user) {
            setName(session.user.name || '')
            setEmail(session.user.email || '')
        }
    }, [session])

    useEffect(() => {
        if (activeSection === 'integrations' && currentWorkspaceId) {
            fetchIntegrations()
        }
    }, [activeSection, currentWorkspaceId])

    const showToastMessage = (message: string, type: 'success' | 'error') => {
        setToastMessage(message)
        setToastType(type)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
    }

    // ── Profile ───────────────────────────────────────────────────────────────
    const handleSaveProfile = async () => {
        if (!name.trim()) {
            showToastMessage(t('settings.profile.nameRequired'), 'error')
            return
        }
        setIsLoading(true)
        try {
            const response = await fetch('/api/user', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            })
            if (response.ok) {
                await update()
                showToastMessage(t('settings.profile.updateSuccess'), 'success')
            } else {
                const data = await response.json()
                showToastMessage(data.error || t('settings.profile.updateFailed'), 'error')
            }
        } catch {
            showToastMessage(t('settings.profile.genericError'), 'error')
        } finally {
            setIsLoading(false)
        }
    }

    // ── Appearance ────────────────────────────────────────────────────────────
    const handleSaveTheme = async (newTheme: 'light' | 'dark' | 'system') => {
        setTheme(newTheme)
        setIsLoading(true)
        try {
            const response = await fetch('/api/user', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: newTheme }),
            })
            if (response.ok) {
                await update()
                showToastMessage(t('settings.appearance.updateSuccess'), 'success')
            } else {
                const data = await response.json()
                showToastMessage(data.error || t('settings.appearance.updateFailed'), 'error')
            }
        } catch {
            showToastMessage(t('settings.profile.genericError'), 'error')
        } finally {
            setIsLoading(false)
        }
    }

    // ── Security ──────────────────────────────────────────────────────────────
    const handleChangePassword = async () => {
        setPasswordError('')
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError(t('settings.security.allFieldsRequired'))
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordError(t('settings.security.passwordMismatch'))
            return
        }
        if (newPassword.length < 8) {
            setPasswordError(t('settings.security.passwordTooShort'))
            return
        }
        setIsLoading(true)
        try {
            const response = await fetch('/api/user/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            })
            if (response.ok) {
                showToastMessage(t('settings.security.updateSuccess'), 'success')
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
            } else {
                const data = await response.json()
                setPasswordError(data.error || t('settings.security.updateFailed'))
                showToastMessage(data.error || t('settings.security.updateFailed'), 'error')
            }
        } catch {
            showToastMessage(t('settings.security.genericError'), 'error')
        } finally {
            setIsLoading(false)
        }
    }

    // ── Integrations ──────────────────────────────────────────────────────────
    const fetchIntegrations = async () => {
        if (!currentWorkspaceId) return
        setIntegrationsLoading(true)
        try {
            const res = await fetch(`/api/scheduling/integrations?workspaceId=${currentWorkspaceId}`)
            if (res.ok) {
                const data = await res.json()
                setCalendarIntegrations(data.calendarIntegrations || [])
                setVideoConfigs(data.videoConfigs || [])
            }
        } catch {
            // non-fatal
        } finally {
            setIntegrationsLoading(false)
        }
    }

    const handleConnectOAuth = async (platform: string) => {
        if (!currentWorkspaceId) return
        setConnectingPlatform(platform)
        try {
            const res = await fetch('/api/scheduling/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: currentWorkspaceId, platform }),
            })
            const data = await res.json()
            if (!res.ok) {
                showToastMessage(data.error || t('settings.integrations.oauthStartFailed'), 'error')
                return
            }
            window.location.href = data.oauthUrl
        } catch {
            showToastMessage(t('settings.integrations.connectionFailed'), 'error')
        } finally {
            setConnectingPlatform(null)
        }
    }

    const handleDisconnectCalendar = async (id: string) => {
        try {
            const res = await fetch(`/api/scheduling/integrations/${id}`, { method: 'DELETE' })
            if (res.ok) {
                showToastMessage(t('settings.integrations.disconnectSuccess'), 'success')
                await fetchIntegrations()
            } else {
                showToastMessage(t('settings.integrations.disconnectFailed'), 'error')
            }
        } catch {
            showToastMessage(t('settings.integrations.genericError'), 'error')
        }
    }

    // ── Sidebar sections ──────────────────────────────────────────────────────
    const settingsSections = [
        { id: 'profile', label: t('settings.nav.profile'), icon: User },
        { id: 'notifications', label: t('settings.nav.notifications'), icon: Bell },
        { id: 'appearance', label: t('settings.nav.appearance'), icon: Palette },
        { id: 'security', label: t('settings.nav.security'), icon: Shield },
        { id: 'integrations', label: t('settings.nav.integrations'), icon: Plug },
        { id: 'billing', label: t('settings.nav.billing'), icon: CreditCard },
    ]

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
            </div>
        )
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    const googleIntegration = calendarIntegrations.find(i => i.type === 'google_calendar')
    const calcomIntegration = calendarIntegrations.find(i => i.type === 'calcom')
    const zoomConfig = videoConfigs.find(v => v.platform === 'zoom')

    return (
        <AppShell>
            <div className="max-w-6xl mx-auto px-8 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-semibold text-on-surface mb-2">{t('settings.pageTitle')}</h1>
                    <p className="text-on-surface-variant">{t('settings.pageSubtitle')}</p>
                </div>

                <div className="flex gap-8">
                    {/* Sidebar */}
                    <aside className="w-64 flex-shrink-0">
                        <nav className="space-y-1">
                            {settingsSections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeSection === section.id
                                        ? 'bg-surface-container-highest text-secondary'
                                        : 'text-on-surface-variant hover:bg-surface-container-low'
                                        }`}
                                >
                                    <section.icon className="h-5 w-5" />
                                    <span className="font-medium">{section.label}</span>
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* Content */}
                    <main className="flex-1 max-w-2xl">

                        {activeSection === 'billing' && <PlanUsageSettings workspaceId={currentWorkspaceId} />}

                        {/* ── Profile ─────────────────────────────────────────── */}
                        {activeSection === 'profile' && (
                            <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-on-secondary text-2xl font-bold">
                                        {name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-on-surface">{t('settings.profile.heading')}</h2>
                                        <p className="text-on-surface-variant text-sm">{t('settings.profile.subtitle')}</p>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface mb-2">{t('settings.profile.nameLabel')}</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full px-4 py-3 bg-surface-container-high rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                            placeholder={t('settings.profile.namePlaceholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface mb-2">{t('settings.profile.emailLabel')}</label>
                                        <input
                                            type="email"
                                            value={email}
                                            disabled
                                            className="w-full px-4 py-3 bg-surface-container-high rounded-lg text-on-surface-variant cursor-not-allowed"
                                        />
                                        <p className="text-xs text-on-surface-variant mt-1">{t('settings.profile.emailCannotChange')}</p>
                                    </div>
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-secondary"></div><span>{t('settings.profile.saving')}</span></>
                                        ) : (
                                            <><Save className="h-4 w-4" /><span>{t('settings.profile.saveChanges')}</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Notifications ────────────────────────────────────── */}
                        {activeSection === 'notifications' && (
                            <NotificationSettings onToast={showToastMessage} />
                        )}

                        {/* ── Appearance ───────────────────────────────────────── */}
                        {activeSection === 'appearance' && (
                            <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                <div className="mb-6">
                                    <h2 className="text-xl font-semibold text-on-surface">{t('settings.appearance.heading')}</h2>
                                    <p className="text-on-surface-variant text-sm">{t('settings.appearance.subtitle')}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface mb-3">{t('settings.appearance.themeLabel')}</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { value: 'light', label: t('settings.appearance.light'), icon: 'light_mode' },
                                            { value: 'dark', label: t('settings.appearance.dark'), icon: 'dark_mode' },
                                            { value: 'system', label: t('settings.appearance.system'), icon: 'computer' },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => handleSaveTheme(option.value as 'light' | 'dark' | 'system')}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${theme === option.value
                                                    ? 'border-secondary bg-secondary/10'
                                                    : 'border-outline-variant/30 hover:border-outline-variant/50'
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-2xl">{option.icon}</span>
                                                <span className="text-sm font-medium text-on-surface">{option.label}</span>
                                                {theme === option.value && <Check className="h-4 w-4 text-secondary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Security ─────────────────────────────────────────── */}
                        {activeSection === 'security' && (
                            <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                <div className="mb-6">
                                    <h2 className="text-xl font-semibold text-on-surface">{t('settings.security.heading')}</h2>
                                    <p className="text-on-surface-variant text-sm">{t('settings.security.subtitle')}</p>
                                </div>
                                <div className="space-y-6">
                                    {[
                                        { label: t('settings.security.currentPasswordLabel'), value: currentPassword, set: setCurrentPassword, placeholder: t('settings.security.currentPasswordPlaceholder'), hint: null },
                                        { label: t('settings.security.newPasswordLabel'), value: newPassword, set: setNewPassword, placeholder: t('settings.security.newPasswordPlaceholder'), hint: t('settings.security.newPasswordHint') },
                                        { label: t('settings.security.confirmPasswordLabel'), value: confirmPassword, set: setConfirmPassword, placeholder: t('settings.security.confirmPasswordPlaceholder'), hint: null },
                                    ].map(({ label, value, set, placeholder, hint }) => (
                                        <div key={label}>
                                            <label className="block text-sm font-medium text-on-surface mb-2">{label}</label>
                                            <input
                                                type="password"
                                                value={value}
                                                onChange={(e) => set(e.target.value)}
                                                className="w-full px-4 py-3 bg-surface-container-high rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                                placeholder={placeholder}
                                            />
                                            {hint && <p className="text-xs text-on-surface-variant mt-1">{hint}</p>}
                                        </div>
                                    ))}
                                    {passwordError && (
                                        <div className="flex items-center gap-2 p-3 bg-error-container/10 rounded-lg text-error-container text-sm">
                                            <X className="h-4 w-4 flex-shrink-0" />
                                            <span>{passwordError}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-secondary"></div><span>{t('misc.updating')}</span></>
                                        ) : (
                                            <><Shield className="h-4 w-4" /><span>{t('misc.updatePassword')}</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Integrations ─────────────────────────────────────── */}
                        {activeSection === 'integrations' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-on-surface">{t('misc.integrations')}</h2>
                                    <p className="text-on-surface-variant text-sm mt-1">{t('misc.integrationsDesc')}</p>
                                </div>

                                {integrationsLoading ? (
                                    <div className="flex items-center gap-2 py-12 justify-center text-on-surface-variant">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span className="text-sm">{t('misc.loadingIntegrations')}</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* ── Calendar section ── */}
                                        <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Calendar className="h-5 w-5 text-secondary" />
                                                <h3 className="font-semibold text-on-surface">{t('misc.calendar')}</h3>
                                            </div>
                                            <div className="space-y-3">

                                                {/* Google Calendar */}
                                                <IntegrationRow
                                                    logo={<GoogleCalendarLogo />}
                                                    name="Google Calendar"
                                                    description="Sync meetings and events with Google Calendar"
                                                    connected={!!googleIntegration}
                                                    connectedLabel={googleIntegration?.providerEmail}
                                                    connecting={connectingPlatform === 'google_calendar'}
                                                    onConnect={() => handleConnectOAuth('google_calendar')}
                                                    onDisconnect={googleIntegration ? () => handleDisconnectCalendar(googleIntegration.id) : undefined}
                                                />

                                                {/* Cal.com */}
                                                <IntegrationRow
                                                    logo={<CalComLogo />}
                                                    name="Cal.com"
                                                    description="Connect your Cal.com account for scheduling"
                                                    connected={!!calcomIntegration}
                                                    connectedLabel={calcomIntegration?.providerEmail}
                                                    connecting={connectingPlatform === 'calcom'}
                                                    onConnect={() => handleConnectOAuth('calcom')}
                                                    onDisconnect={calcomIntegration ? () => handleDisconnectCalendar(calcomIntegration.id) : undefined}
                                                />
                                            </div>
                                        </div>

                                        {/* ── Video section ── */}
                                        <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Video className="h-5 w-5 text-secondary" />
                                                <h3 className="font-semibold text-on-surface">{t('misc.videoConferencing')}</h3>
                                            </div>
                                            <div className="space-y-3">

                                                {/* Zoom */}
                                                <IntegrationRow
                                                    logo={<ZoomLogo />}
                                                    name="Zoom"
                                                    description="Auto-generate Zoom links for scheduled meetings"
                                                    connected={!!zoomConfig}
                                                    connectedLabel={zoomConfig?.providerEmail}
                                                    connecting={connectingPlatform === 'zoom'}
                                                    onConnect={() => handleConnectOAuth('zoom')}
                                                    onDisconnect={undefined}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {showToast && (
                <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
            )}
        </AppShell>
    )
}

// ── Brand SVG logos ───────────────────────────────────────────────────────────
function GoogleCalendarLogo() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="3" fill="#fff" stroke="#dadce0" strokeWidth="1"/>
            <rect x="2" y="7" width="20" height="2" fill="#4285F4"/>
            <rect x="7" y="2" width="2" height="5" rx="1" fill="#4285F4"/>
            <rect x="15" y="2" width="2" height="5" rx="1" fill="#4285F4"/>
            <text x="12" y="18" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#4285F4">G</text>
        </svg>
    )
}

function CalComLogo() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="4" fill="#111827"/>
            <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff" fontFamily="sans-serif">cal</text>
        </svg>
    )
}

function ZoomLogo() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="4" fill="#2D8CFF"/>
            <path d="M4 8.5C4 7.67 4.67 7 5.5 7h9C15.33 7 16 7.67 16 8.5v7c0 .83-.67 1.5-1.5 1.5h-9C4.67 17 4 16.33 4 15.5v-7z" fill="#fff"/>
            <path d="M16.5 10.2l3.2-2.1A.5.5 0 0120 8.5v7a.5.5 0 01-.8.4l-3.2-2.1V10.2z" fill="#fff"/>
        </svg>
    )
}

// ── IntegrationRow component ──────────────────────────────────────────────────
interface IntegrationRowProps {
    logo: React.ReactNode
    name: string
    description: string
    connected: boolean
    connectedLabel?: string
    connecting: boolean
    onConnect: () => void
    onDisconnect?: () => void
}

function IntegrationRow({
    logo, name, description, connected, connectedLabel,
    connecting, onConnect, onDisconnect
}: IntegrationRowProps) {
    const { t } = useI18n();
    return (
        <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-lg">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                    {logo}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-on-surface text-sm">{name}</span>
                        {connected && (
                            <span className="flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                                <CheckCircle className="h-3 w-3" />
                                Connected
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                        {connected && connectedLabel ? connectedLabel : description}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {connected ? (
                    <>
                        {onDisconnect && (
                            <button
                                onClick={onDisconnect}
                                title={t('misc.disconnect')}
                                className="p-2 text-on-surface-variant hover:text-error rounded-lg hover:bg-error/10 transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                    </>
                ) : (
                    <button
                        onClick={onConnect}
                        disabled={connecting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors disabled:opacity-50"
                    >
                        {connecting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Plug className="h-3.5 w-3.5" />
                        )}
                        Connect
                    </button>
                )}
            </div>
        </div>
    )
}

export default function SettingsPage() {
    return (
        <Suspense>
            <SettingsPageInner />
        </Suspense>
    )
}

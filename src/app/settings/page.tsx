'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAppStore } from '@/store/appStore'
import Toast from '@/components/Toast'
import { PlanUsageSettings } from '@/components/billing/PlanUsageSettings'
import {
    User, Bell, Shield, Palette, Check, X, Save,
    ExternalLink, Loader2, CheckCircle, AlertCircle,
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

interface StripeStatus {
    connected: boolean
    chargesEnabled: boolean
    detailsSubmitted: boolean
}

function SettingsPageInner() {
    const { data: session, status, update } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { theme, setTheme, currentWorkspaceId } = useAppStore()

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

    // Notifications state
    const [emailNotifications, setEmailNotifications] = useState(true)
    const [pushNotifications, setPushNotifications] = useState(true)

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
    const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
    const [stripeLoading, setStripeLoading] = useState(false)
    const [stripeConnecting, setStripeConnecting] = useState(false)
    // Stripe direct API keys state
    const [stripeKeys, setStripeKeys] = useState<{ hasSecretKey: boolean; secretKeyLast4: string | null; hasPublishableKey: boolean; publishableKey: string | null; directKeysEnabled: boolean } | null>(null)
    const [stripeKeysLoading, setStripeKeysLoading] = useState(false)
    const [newSecretKey, setNewSecretKey] = useState('')
    const [newPublishableKey, setNewPublishableKey] = useState('')
    const [stripeKeysSaving, setStripeKeysSaving] = useState(false)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
        }
    }, [status, router])

    useEffect(() => {
        if (session?.user) {
            setName(session.user.name || '')
            setEmail(session.user.email || '')
            setEmailNotifications(session.user.notificationsEmail ?? true)
            setPushNotifications(session.user.notificationsPush ?? true)
        }
    }, [session])

    useEffect(() => {
        if (activeSection === 'integrations' && currentWorkspaceId) {
            fetchIntegrations()
            fetchStripeStatus()
            fetchStripeKeys()
        }
    }, [activeSection, currentWorkspaceId])

    // Auto-refresh Stripe status and show feedback after Stripe onboarding redirect
    useEffect(() => {
        const stripeParam = searchParams.get('stripe')
        if (!stripeParam || !currentWorkspaceId) return
        setActiveSection('integrations')
        if (stripeParam === 'success') {
            fetchStripeStatus()
            showToastMessage('Stripe connected successfully!', 'success')
        } else if (stripeParam === 'refresh') {
            showToastMessage('Stripe onboarding incomplete. Please try again.', 'error')
        }
    }, [searchParams, currentWorkspaceId])

    const showToastMessage = (message: string, type: 'success' | 'error') => {
        setToastMessage(message)
        setToastType(type)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
    }

    // ── Profile ───────────────────────────────────────────────────────────────
    const handleSaveProfile = async () => {
        if (!name.trim()) {
            showToastMessage('Name is required', 'error')
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
                showToastMessage('Profile updated successfully', 'success')
            } else {
                const data = await response.json()
                showToastMessage(data.error || 'Failed to update profile', 'error')
            }
        } catch {
            showToastMessage('An error occurred', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    const handleSaveNotifications = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/user', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationsEmail: emailNotifications, notificationsPush: pushNotifications }),
            })
            if (response.ok) {
                await update()
                showToastMessage('Notification preferences updated', 'success')
            } else {
                const data = await response.json()
                showToastMessage(data.error || 'Failed to update notifications', 'error')
            }
        } catch {
            showToastMessage('An error occurred', 'error')
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
                showToastMessage('Theme updated successfully', 'success')
            } else {
                const data = await response.json()
                showToastMessage(data.error || 'Failed to update theme', 'error')
            }
        } catch {
            showToastMessage('An error occurred', 'error')
        } finally {
            setIsLoading(false)
        }
    }

    // ── Security ──────────────────────────────────────────────────────────────
    const handleChangePassword = async () => {
        setPasswordError('')
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('All password fields are required')
            return
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match')
            return
        }
        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters')
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
                showToastMessage('Password updated successfully', 'success')
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
            } else {
                const data = await response.json()
                setPasswordError(data.error || 'Failed to update password')
                showToastMessage(data.error || 'Failed to update password', 'error')
            }
        } catch {
            showToastMessage('An error occurred', 'error')
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
                showToastMessage(data.error || 'Failed to start OAuth', 'error')
                return
            }
            window.location.href = data.oauthUrl
        } catch {
            showToastMessage('Failed to start connection', 'error')
        } finally {
            setConnectingPlatform(null)
        }
    }

    const handleDisconnectCalendar = async (id: string) => {
        try {
            const res = await fetch(`/api/scheduling/integrations/${id}`, { method: 'DELETE' })
            if (res.ok) {
                showToastMessage('Integration disconnected', 'success')
                await fetchIntegrations()
            } else {
                showToastMessage('Failed to disconnect', 'error')
            }
        } catch {
            showToastMessage('An error occurred', 'error')
        }
    }

    const fetchStripeStatus = async () => {
        if (!currentWorkspaceId) return
        setStripeLoading(true)
        try {
            const res = await fetch(`/api/stripe/connect/status?workspaceId=${currentWorkspaceId}`)
            if (res.ok) {
                const data = await res.json()
                setStripeStatus(data)
            }
        } catch {
            // non-fatal
        } finally {
            setStripeLoading(false)
        }
    }

    const handleConnectStripe = async () => {
        if (!currentWorkspaceId) return
        setStripeConnecting(true)
        try {
            const res = await fetch('/api/stripe/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: currentWorkspaceId }),
            })
            const data = await res.json()
            if (!res.ok) {
                showToastMessage(data.error || 'Failed to start Stripe Connect', 'error')
                return
            }
            if (data.alreadyConnected) {
                showToastMessage('Stripe is already connected', 'success')
                await fetchStripeStatus()
                return
            }
            window.location.href = data.onboardingUrl
        } catch {
            showToastMessage('Failed to start Stripe Connect', 'error')
        } finally {
            setStripeConnecting(false)
        }
    }

    const handleOpenStripeDashboard = async () => {
        if (!currentWorkspaceId) return
        setStripeLoading(true)
        try {
            const res = await fetch('/api/stripe/connect/login-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: currentWorkspaceId }),
            })
            const data = await res.json()
            if (!res.ok) {
                showToastMessage(data.error || 'Failed to open Stripe dashboard', 'error')
                return
            }
            window.open(data.loginUrl, '_blank')
        } catch {
            showToastMessage('Failed to open Stripe dashboard', 'error')
        } finally {
            setStripeLoading(false)
        }
    }

    const fetchStripeKeys = async () => {
        if (!currentWorkspaceId) return
        setStripeKeysLoading(true)
        try {
            const res = await fetch(`/api/stripe/settings?workspaceId=${currentWorkspaceId}`)
            if (res.ok) setStripeKeys(await res.json())
        } catch { /* non-fatal */ } finally { setStripeKeysLoading(false) }
    }

    const handleSaveStripeKeys = async () => {
        if (!currentWorkspaceId) return
        if (!newSecretKey && !newPublishableKey) {
            showToastMessage('Please enter at least one key', 'error')
            return
        }
        setStripeKeysSaving(true)
        try {
            const res = await fetch('/api/stripe/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: currentWorkspaceId, secretKey: newSecretKey || undefined, publishableKey: newPublishableKey || undefined }),
            })
            const data = await res.json()
            if (!res.ok) { showToastMessage(data.error || 'Failed to save keys', 'error'); return }
            showToastMessage('Stripe API keys saved successfully', 'success')
            setNewSecretKey('')
            setNewPublishableKey('')
            await fetchStripeKeys()
        } catch { showToastMessage('An error occurred', 'error') } finally { setStripeKeysSaving(false) }
    }

    const handleClearStripeKeys = async () => {
        if (!currentWorkspaceId || !confirm('Clear your Stripe API keys? Payment links will stop working until new keys are added.')) return
        setStripeKeysSaving(true)
        try {
            const res = await fetch('/api/stripe/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceId: currentWorkspaceId, clear: true }),
            })
            if (!res.ok) { showToastMessage('Failed to clear keys', 'error'); return }
            showToastMessage('Stripe keys cleared', 'success')
            await fetchStripeKeys()
        } catch { showToastMessage('An error occurred', 'error') } finally { setStripeKeysSaving(false) }
    }

    // ── Sidebar sections ──────────────────────────────────────────────────────
    const settingsSections = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'integrations', label: 'Integrations', icon: Plug },
        { id: 'billing', label: 'Plan & usage', icon: CreditCard },
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
                    <h1 className="text-3xl font-semibold text-on-surface mb-2">Settings</h1>
                    <p className="text-on-surface-variant">Manage your account preferences</p>
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
                                        <h2 className="text-xl font-semibold text-on-surface">Profile</h2>
                                        <p className="text-on-surface-variant text-sm">Update your personal information</p>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface mb-2">Name</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full px-4 py-3 bg-surface-container-high rounded-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                            placeholder="Your name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-on-surface mb-2">Email</label>
                                        <input
                                            type="email"
                                            value={email}
                                            disabled
                                            className="w-full px-4 py-3 bg-surface-container-high rounded-lg text-on-surface-variant cursor-not-allowed"
                                        />
                                        <p className="text-xs text-on-surface-variant mt-1">Email cannot be changed</p>
                                    </div>
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-secondary"></div><span>Saving...</span></>
                                        ) : (
                                            <><Save className="h-4 w-4" /><span>Save Changes</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Notifications ────────────────────────────────────── */}
                        {activeSection === 'notifications' && (
                            <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                <div className="mb-6">
                                    <h2 className="text-xl font-semibold text-on-surface">Notifications</h2>
                                    <p className="text-on-surface-variant text-sm">Manage how you receive notifications</p>
                                </div>
                                <div className="space-y-6">
                                    {[
                                        { label: 'Email Notifications', desc: 'Receive email updates about your activity', value: emailNotifications, set: setEmailNotifications },
                                        { label: 'Push Notifications', desc: 'Receive push notifications in your browser', value: pushNotifications, set: setPushNotifications },
                                    ].map(({ label, desc, value, set }) => (
                                        <div key={label} className="flex items-center justify-between p-4 bg-surface-container-high rounded-lg">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                                                    <Bell className="h-5 w-5 text-secondary" />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-on-surface">{label}</h3>
                                                    <p className="text-sm text-on-surface-variant mt-1">{desc}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => set(!value)}
                                                className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${value ? 'bg-secondary' : 'bg-outline-variant'}`}
                                            >
                                                <span className={`inline-block w-5 h-5 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleSaveNotifications}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-secondary"></div><span>Saving...</span></>
                                        ) : (
                                            <><Save className="h-4 w-4" /><span>Save Changes</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Appearance ───────────────────────────────────────── */}
                        {activeSection === 'appearance' && (
                            <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                <div className="mb-6">
                                    <h2 className="text-xl font-semibold text-on-surface">Appearance</h2>
                                    <p className="text-on-surface-variant text-sm">Customize your theme</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-on-surface mb-3">Theme</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { value: 'light', label: 'Light', icon: 'light_mode' },
                                            { value: 'dark', label: 'Dark', icon: 'dark_mode' },
                                            { value: 'system', label: 'System', icon: 'computer' },
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
                                    <h2 className="text-xl font-semibold text-on-surface">Security</h2>
                                    <p className="text-on-surface-variant text-sm">Update your password</p>
                                </div>
                                <div className="space-y-6">
                                    {[
                                        { label: 'Current Password', value: currentPassword, set: setCurrentPassword, placeholder: 'Enter current password', hint: null },
                                        { label: 'New Password', value: newPassword, set: setNewPassword, placeholder: 'Enter new password', hint: 'Must be at least 8 characters' },
                                        { label: 'Confirm New Password', value: confirmPassword, set: setConfirmPassword, placeholder: 'Confirm new password', hint: null },
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
                                            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-secondary"></div><span>Updating...</span></>
                                        ) : (
                                            <><Shield className="h-4 w-4" /><span>Update Password</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Integrations ─────────────────────────────────────── */}
                        {activeSection === 'integrations' && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-on-surface">Integrations</h2>
                                    <p className="text-on-surface-variant text-sm mt-1">Connect external services to your workspace</p>
                                </div>

                                {integrationsLoading || stripeLoading ? (
                                    <div className="flex items-center gap-2 py-12 justify-center text-on-surface-variant">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span className="text-sm">Loading integrations…</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* ── Calendar section ── */}
                                        <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Calendar className="h-5 w-5 text-secondary" />
                                                <h3 className="font-semibold text-on-surface">Calendar</h3>
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
                                                <h3 className="font-semibold text-on-surface">Video Conferencing</h3>
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

                                        {/* ── Payments section ── */}
                                        <div className="bg-surface-container-low rounded-lg p-6 ambient-shadow">
                                            <div className="flex items-center gap-2 mb-1">
                                                <StripeLogo />
                                                <h3 className="font-semibold text-on-surface">Payments — Stripe Keys</h3>
                                            </div>
                                            <p className="text-xs text-on-surface-variant mb-5">
                                                Enter your Stripe API keys to generate payment links on invoices. Keys are stored encrypted.
                                            </p>

                                            {stripeKeysLoading ? (
                                                <div className="flex items-center gap-2 py-4 text-on-surface-variant text-sm">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading keys…
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {/* Current key status */}
                                                    {stripeKeys?.hasSecretKey && (
                                                        <div className="flex items-center gap-2 p-3 bg-success/5 border border-success/20 rounded-lg text-sm">
                                                            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                                                            <span className="text-on-surface flex-1">
                                                                Secret key saved (ending ···{stripeKeys.secretKeyLast4})
                                                                {stripeKeys.hasPublishableKey && ' · Publishable key saved'}
                                                            </span>
                                                            <button
                                                                onClick={handleClearStripeKeys}
                                                                disabled={stripeKeysSaving}
                                                                className="flex items-center gap-1 text-xs text-error hover:text-error/80 transition-colors disabled:opacity-50"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Clear
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Key inputs */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                                                            Secret Key <span className="text-on-surface-variant/60">(sk_live_ or sk_test_)</span>
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={newSecretKey}
                                                            onChange={(e) => setNewSecretKey(e.target.value)}
                                                            placeholder={stripeKeys?.hasSecretKey ? '••••••••••••••••••••••• (leave blank to keep current)' : 'sk_live_...'}
                                                            className="w-full px-3 py-2.5 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                                                            Publishable Key <span className="text-on-surface-variant/60">(pk_live_ or pk_test_)</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={newPublishableKey}
                                                            onChange={(e) => setNewPublishableKey(e.target.value)}
                                                            placeholder={stripeKeys?.publishableKey ? stripeKeys.publishableKey : 'pk_live_...'}
                                                            className="w-full px-3 py-2.5 bg-surface-container-high rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all"
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-3 pt-1">
                                                        <button
                                                            onClick={handleSaveStripeKeys}
                                                            disabled={stripeKeysSaving || (!newSecretKey && !newPublishableKey)}
                                                            className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim text-sm font-medium disabled:opacity-50 transition-colors"
                                                        >
                                                            {stripeKeysSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                                            Save Keys
                                                        </button>
                                                        <a
                                                            href="https://dashboard.stripe.com/apikeys"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-xs text-secondary hover:underline"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            Get keys from Stripe dashboard
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Legacy Connect section (collapsed, secondary) */}
                                            {stripeStatus && (
                                                <div className="mt-6 pt-5 border-t border-outline-variant/10">
                                                    <p className="text-xs font-medium text-on-surface-variant mb-3">Stripe Connect (OAuth) — Legacy</p>
                                                    <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                                                        stripeStatus.chargesEnabled
                                                            ? 'bg-success/5 border-success/20'
                                                            : stripeStatus.connected
                                                            ? 'bg-warning/5 border-warning/20'
                                                            : 'bg-surface-container border-outline-variant/20'
                                                    }`}>
                                                        {stripeStatus.chargesEnabled ? (
                                                            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                                                        ) : stripeStatus.connected ? (
                                                            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
                                                        ) : (
                                                            <CreditCard className="h-4 w-4 text-on-surface-variant flex-shrink-0" />
                                                        )}
                                                        <div className="flex-1">
                                                            <p className="text-xs font-medium text-on-surface">
                                                                {stripeStatus.chargesEnabled ? 'Connect — Enabled' : stripeStatus.connected ? 'Connect — Incomplete' : 'Connect — Not set up'}
                                                            </p>
                                                        </div>
                                                        {!stripeStatus.chargesEnabled && (
                                                            <button
                                                                onClick={handleConnectStripe}
                                                                disabled={stripeConnecting}
                                                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-secondary text-on-secondary rounded-lg hover:bg-secondary-dim disabled:opacity-50 transition-colors"
                                                            >
                                                                {stripeConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                                                {stripeStatus.connected ? 'Resume' : 'Connect'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
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

function StripeLogo() {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="4" fill="#635BFF"/>
            <path d="M11.1 9.3c0-.6.5-.9 1.3-.9 1.1 0 2.3.4 3.2.9V6.5c-1-.4-2.1-.6-3.2-.6-2.6 0-4.4 1.4-4.4 3.6 0 3.5 4.8 2.9 4.8 4.4 0 .7-.6 1-1.4 1-1.2 0-2.6-.5-3.7-1.2v2.9c1.2.5 2.5.8 3.7.8 2.7 0 4.5-1.3 4.5-3.6-.1-3.8-4.8-3.1-4.8-4.5z" fill="#fff"/>
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
                                title="Disconnect"
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

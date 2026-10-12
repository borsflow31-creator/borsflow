'use client'

/**
 * Settings: audiences (segments) and sending (providers).
 */

import { useState } from 'react'
import { Users, Settings, Plus, Clock, CheckCircle2, XCircle, AlertCircle, Zap, Target, List, RefreshCw, Server } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import type { SegmentationRule, EmailProvider } from '../types'


/**
 * Settings: who the emails go to, and what sends them.
 *
 * Audiences and sending were two tabs of their own. Both are things you set up
 * once and come back to rarely, which is what made them a poor use of the tab
 * bar, so they are sections here — anchored, so the links that used to point at
 * `?tab=segments` and `?tab=providers` still land on the right one.
 */
export default function SettingsTab({
  segments,
  providers,
  loading,
  onEditSegment,
  onCreateSegment,
  onDeleteSegment,
  onEditProvider,
  onCreateProvider,
  onTestProvider,
  onDeleteProvider,
  onRetryTracking,
}: {
  segments: SegmentationRule[]
  providers: EmailProvider[]
  loading: boolean
  onEditSegment: (s: SegmentationRule) => void
  onCreateSegment: () => void
  onDeleteSegment: (id: string) => void
  onEditProvider: (p: EmailProvider) => void
  onCreateProvider: () => void
  onTestProvider: (p: EmailProvider) => Promise<{ success: boolean; message: string }>
  onDeleteProvider: (id: string) => void
  onRetryTracking: (id: string) => Promise<void>
}) {
  return (
    <div className="space-y-10 sm:space-y-12">
      <section id="audiences" className="scroll-mt-24">
        <AudiencesSection
          segments={segments}
          loading={loading}
          onEdit={onEditSegment}
          onCreate={onCreateSegment}
          onDelete={onDeleteSegment}
        />
      </section>
      <section id="sending" className="scroll-mt-24">
        <SendingSection
          providers={providers}
          loading={loading}
          onEdit={onEditProvider}
          onCreate={onCreateProvider}
          onTest={onTestProvider}
          onDelete={onDeleteProvider}
          onRetryTracking={onRetryTracking}
        />
      </section>
    </div>
  )
}

function AudiencesSection({ segments, loading, onEdit, onCreate, onDelete }: { segments: SegmentationRule[]; loading: boolean; onEdit: (s: SegmentationRule) => void; onCreate: () => void; onDelete: (id: string) => void }) {
  const { t } = useI18n()
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.segmentsTab.heading')}
        </h2>
        <p className="text-on-surface-variant">
          {t('emailMarketing.segmentsTab.subtitle')}
        </p>
      </div>

      {/* Segment Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-secondary">
              {segments.length}
            </div>
            <Users className="h-8 w-8 text-secondary/20" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.segmentsTab.statActiveSegments')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              {segments.reduce((acc, s) => acc + (s.estimatedSize || 0), 0).toLocaleString()}
            </div>
            <Target className="h-8 w-8 text-green-200 dark:text-green-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.segmentsTab.statTotalLeads')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">
              {segments.filter(s => s.isActive).length}
            </div>
            <Zap className="h-8 w-8 text-blue-200 dark:text-blue-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.segmentsTab.statActiveRules')}
          </div>
        </div>
      </div>

      {/* Segment List */}
      <div className="bg-surface-container-low rounded-lg shadow">
        <div className="p-4 sm:p-6 border-b border-outline-variant/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h3 className="text-lg font-semibold text-on-surface">
              {t('emailMarketing.segmentsTab.listHeading', { count: segments.length })}
            </h3>
            <button className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              <span>{t('emailMarketing.segmentsTab.createSegment')}</span>
            </button>
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            {t('emailMarketing.segmentsTab.loading')}
          </div>
        ) : segments.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="h-16 w-16 text-on-surface-variant/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-on-surface mb-2">{t('emailMarketing.segmentsTab.emptyTitle')}</h3>
            <p className="text-on-surface-variant mb-4">
              {t('emailMarketing.segmentsTab.emptySubtitle')}
            </p>
            <button className="px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors" onClick={onCreate}>
              {t('emailMarketing.segmentsTab.createSegment')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {segments.map((segment: SegmentationRule) => (
              <div key={segment.id} className="p-4 sm:p-6 hover:bg-surface-container-high transition-colors">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-on-surface">
                        {segment.name}
                      </h4>
                      {segment.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded">
                          {t('emailMarketing.segmentsTab.active')}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-surface-container-highest text-on-surface-variant rounded">
                          {t('emailMarketing.segmentsTab.inactive')}
                        </span>
                      )}
                      {segment.estimatedSize != null && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                          {t('emailMarketing.segmentsTab.leadsCount', { count: segment.estimatedSize.toLocaleString() })}
                        </span>
                      )}
                    </div>
                    {segment.description && (
                      <p className="text-on-surface-variant text-sm">
                        {segment.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <button className="px-3 py-1.5 text-sm border border-outline-variant/40 rounded hover:bg-surface-container-high" onClick={() => onEdit(segment)}>
                      {t('common.edit')}
                    </button>
                    <button className="px-3 py-1.5 text-sm border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => onDelete(segment.id)}>
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Whether bounce and complaint tracking is live on this provider. BorsFlow sets it
 * up on the client's own account when they save, so there is nothing to
 * configure; this only surfaces the outcome, and a Retry when it didn't finish.
 */
function TrackingStatus({ provider, onRetry }: { provider: EmailProvider; onRetry: (id: string) => Promise<void> }) {
  const { t } = useI18n()
  const [retrying, setRetrying] = useState(false)
  const status = provider.webhookStatus

  if (status === 'active') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 mt-1">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        {t('emailMarketing.providersTab.trackingOn')}
      </div>
    )
  }

  const canRetry = status === 'error' || !status
  const message = provider.webhookError || t('emailMarketing.providersTab.trackingNotSetUp')

  return (
    <div className={`flex items-start gap-1.5 text-sm mt-1 ${status === 'error' || !status ? 'text-amber-700 dark:text-amber-400' : 'text-on-surface-variant'}`}>
      {status === 'waiting_public_url'
        ? <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
        : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
      <span>
        {message}
        {canRetry && (
          <button
            type="button"
            className="ml-2 font-medium text-secondary hover:text-secondary disabled:opacity-50"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true)
              try { await onRetry(provider.id) } finally { setRetrying(false) }
            }}
          >
            {retrying ? t('emailMarketing.providersTab.settingUp') : status ? t('emailMarketing.providersTab.retry') : t('emailMarketing.providersTab.setUpNow')}
          </button>
        )}
      </span>
    </div>
  )
}

const PROVIDER_STYLES: Record<string, { label: string; chip: string }> = {
  sendgrid: { label: 'SendGrid', chip: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  ses:      { label: 'Amazon SES', chip: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
  resend:   { label: 'Resend', chip: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  mailgun:  { label: 'Mailgun', chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  postmark: { label: 'Postmark', chip: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' },
  brevo:    { label: 'Brevo', chip: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
  // Not a company, so it gets the neutral chip and keeps the server icon below.
  smtp:     { label: 'SMTP', chip: 'bg-surface-container-highest text-on-surface-variant border-outline-variant/40' },
}

function SendingSection({ providers, loading, onEdit, onCreate, onTest, onDelete, onRetryTracking }: {
  providers: EmailProvider[]
  loading: boolean
  onEdit: (p: EmailProvider) => void
  onCreate: () => void
  onTest: (p: EmailProvider) => Promise<{ success: boolean; message: string }>
  onDelete: (id: string) => void
  onRetryTracking: (id: string) => Promise<void>
}) {
  const { t, formatNumber } = useI18n()
  // Per-provider test state, shown inline under the card
  const [tests, setTests] = useState<Record<string, { running: boolean; success?: boolean; message?: string }>>({})

  const runTest = async (provider: EmailProvider) => {
    setTests(prev => ({ ...prev, [provider.id]: { running: true } }))
    const result = await onTest(provider)
    setTests(prev => ({ ...prev, [provider.id]: { running: false, ...result } }))
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">
            {t('emailMarketing.providersTab.heading')}
          </h2>
          <p className="text-on-surface-variant">
            {t('emailMarketing.providersTab.subtitle')}
          </p>
        </div>
        {providers.length > 0 && (
          <button onClick={onCreate} className="self-start sm:self-auto px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>{t('emailMarketing.providersTab.addNew')}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg bg-surface-container-low p-12 text-center text-on-surface-variant shadow">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          {t('emailMarketing.providersTab.loading')}
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-outline-variant/40 bg-surface-container-low p-8 sm:p-12 text-center">
          <Server className="h-12 w-12 text-on-surface-variant/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-on-surface mb-2">{t('emailMarketing.providersTab.emptyTitle')}</h3>
          <p className="text-on-surface-variant mb-5 max-w-md mx-auto">{t('emailMarketing.providersTab.emptySubtitle')}</p>
          <button onClick={onCreate} className="px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors">
            {t('emailMarketing.providersTab.addNew')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((provider) => {
            const style = PROVIDER_STYLES[provider.type]
            const test = tests[provider.id]
            return (
              <div key={provider.id} className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-on-surface truncate mr-1">
                        {provider.name}
                      </h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded border flex items-center gap-1.5 ${style?.chip ?? 'bg-surface-container-highest text-on-surface-variant border-transparent'}`}>
                        {style && provider.type !== 'smtp'
                          ? <span aria-hidden className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-white/70 dark:bg-black/20 text-[10px] font-bold">{style.label[0]}</span>
                          : <Server className="w-3.5 h-3.5" />}
                        <span>{style?.label ?? provider.type}</span>
                      </span>
                      {provider.isDefault && (
                        <span className="px-2 py-1 text-xs font-medium bg-secondary/15 text-secondary rounded">
                          {t('emailMarketing.providersTab.default')}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        provider.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {provider.isActive ? t('emailMarketing.providersTab.active') : t('emailMarketing.providersTab.inactive')}
                      </span>
                    </div>
                    <div className="text-on-surface-variant text-sm break-all">
                      {t('emailMarketing.providersTab.from', { email: provider.fromEmail })}
                    </div>
                    <TrackingStatus provider={provider} onRetry={onRetryTracking} />
                    {provider.dailyLimit != null && provider.dailyLimit > 0 && (
                      <div className="text-on-surface-variant text-sm mt-1">
                        {t('emailMarketing.providersTab.dailyLimit', { count: formatNumber(provider.dailyLimit) })}
                      </div>
                    )}
                    {test && !test.running && test.message && (
                      <div className={`mt-2 flex items-start gap-1.5 text-sm ${test.success ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {test.success ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                        <span className="break-words">{test.message}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <button className="px-3 py-1.5 text-sm border border-outline-variant/40 rounded hover:bg-surface-container-high" onClick={() => onEdit(provider)}>
                      {t('emailMarketing.providersTab.configure')}
                    </button>
                    <button
                      className="px-3 py-1.5 text-sm border border-outline-variant/40 rounded hover:bg-surface-container-high disabled:opacity-60 flex items-center gap-1.5"
                      onClick={() => runTest(provider)}
                      disabled={test?.running}
                    >
                      {test?.running && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      {test?.running ? t('emailMarketing.providerModal.testing') : t('emailMarketing.providersTab.test')}
                    </button>
                    <button className="px-3 py-1.5 text-sm border border-red-200 text-red-600 dark:border-red-900/50 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => onDelete(provider.id)}>
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

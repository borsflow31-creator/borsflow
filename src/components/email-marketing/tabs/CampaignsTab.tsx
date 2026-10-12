'use client'

/**
 * Campaigns: the list, and above it the totals that used to be their own
 * Analytics tab.
 */

import { Mail, Send, FileText, Users, Search, Edit, Trash2, Pause, Clock, CheckCircle2, XCircle, AlertCircle, TrendingUp, Eye, MousePointer2, Calendar, LayoutGrid, List, RefreshCw } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import type { EmailCampaign } from '../types'
import { statusLabel } from '../status'

const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'sending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'paused':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />
      case 'scheduled':
        return <Clock className="h-4 w-4" />
      case 'sending':
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'sent':
        return <CheckCircle2 className="h-4 w-4" />
      case 'paused':
        return <Pause className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const calculateOpenRate = (campaign: EmailCampaign) => {
    if (campaign.sentCount === 0) return 0
    return ((campaign.openedCount / campaign.sentCount) * 100).toFixed(1)
  }

  const calculateClickRate = (campaign: EmailCampaign) => {
    if (campaign.openedCount === 0) return 0
    return ((campaign.clickedCount / campaign.openedCount) * 100).toFixed(1)
  }

/**
 * The five numbers that were a whole Analytics tab.
 *
 * They are totals over the campaigns already loaded for the list, so they cost
 * no request; the per-campaign detail that used to sit under them repeated the
 * list below, which is why it is gone.
 */
function CampaignTotals({ campaigns }: { campaigns: EmailCampaign[] }) {
  const { t } = useI18n()
  const sent = campaigns.reduce((acc, c) => acc + c.sentCount, 0)
  // Providers only report bounces back, so delivered = sent minus bounced
  // unless a provider has reported deliveries explicitly.
  const delivered = campaigns.reduce((acc, c) => acc + (c.deliveredCount || Math.max(0, c.sentCount - c.bouncedCount)), 0)
  const opened = campaigns.reduce((acc, c) => acc + c.openedCount, 0)
  const clicked = campaigns.reduce((acc, c) => acc + c.clickedCount, 0)
  const bounced = campaigns.reduce((acc, c) => acc + c.bouncedCount, 0)

  if (sent === 0) return null

  const rate = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0.0%')
  const figures: Array<{ label: string; value: string; tone?: string }> = [
    { label: t('emailMarketing.analyticsTab.totalSent'), value: sent.toLocaleString() },
    { label: t('emailMarketing.analyticsTab.delivered'), value: delivered.toLocaleString() },
    { label: t('emailMarketing.analyticsTab.openRate'), value: rate(opened, sent) },
    { label: t('emailMarketing.analyticsTab.clickRate'), value: rate(clicked, opened) },
    { label: t('emailMarketing.analyticsTab.bounceRate'), value: rate(bounced, sent), tone: bounced > 0 ? 'text-red-600' : undefined },
  ]

  return (
    <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-outline-variant/20 bg-outline-variant/20 sm:grid-cols-5">
      {figures.map(figure => (
        <div key={figure.label} className="bg-surface-container-lowest p-3 sm:p-4">
          <dt className="text-[11px] text-on-surface-variant">{figure.label}</dt>
          <dd className={`text-lg font-semibold tabular-nums sm:text-xl ${figure.tone || 'text-on-surface'}`}>{figure.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function CampaignsTab({
  campaigns,
  loading,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  onCreate,
  onEdit,
  onDelete,
  onSend
}: {
  campaigns: EmailCampaign[]
  loading: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  viewMode: 'grid' | 'list'
  setViewMode: (v: 'grid' | 'list') => void
  onCreate: () => void
  onEdit: (c: EmailCampaign) => void
  onDelete: (id: string) => void
  onSend: (c: EmailCampaign) => void
}) {
  const { t, formatDate } = useI18n()
  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    campaign.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    active: campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled').length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    // Only campaigns that actually went out; drafts would drag the average to 0
    avgOpenRate: (() => {
      const sentOnes = campaigns.filter(c => c.sentCount > 0)
      return sentOnes.length > 0
        ? (sentOnes.reduce((acc, c) => acc + parseFloat(String(calculateOpenRate(c))), 0) / sentOnes.length).toFixed(1)
        : '0.0'
    })()
  }
  // Already sent or going out: nothing left to send
  const canSend = (c: EmailCampaign) => c.status === 'draft' || c.status === 'scheduled'

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.campaignsTab.heading')}
        </h2>
        <p className="text-on-surface-variant">
          {t('emailMarketing.campaignsTab.subtitle')}
        </p>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-secondary">
              {stats.active}
            </div>
            <Send className="h-8 w-8 text-secondary/20" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.campaignsTab.statActive')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">
              {stats.avgOpenRate}%
            </div>
            <TrendingUp className="h-8 w-8 text-green-200 dark:text-green-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.campaignsTab.statAvgOpenRate')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">
              {campaigns.reduce((acc, c) => acc + c.sentCount, 0).toLocaleString()}
            </div>
            <Mail className="h-8 w-8 text-blue-200 dark:text-blue-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.campaignsTab.statTotalSent')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-purple-600">
              {stats.draft}
            </div>
            <FileText className="h-8 w-8 text-purple-200 dark:text-purple-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.campaignsTab.statDraft')}
          </div>
        </div>
      </div>

      {/* Campaign List Header */}
      <div className="bg-surface-container-low rounded-lg shadow">
        <div className="p-4 sm:p-6 border-b border-outline-variant/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h3 className="text-lg font-semibold text-on-surface">
              {t('emailMarketing.campaignsTab.listHeading', { count: filteredCampaigns.length })}
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder={t('emailMarketing.campaignsTab.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-outline-variant/40 rounded-lg bg-transparent focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-1 border-l border-outline-variant/40 pl-3">
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List"
                  aria-pressed={viewMode === 'list'}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-secondary/15 text-secondary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <List className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid"
                  aria-pressed={viewMode === 'grid'}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-secondary/15 text-secondary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            {t('emailMarketing.campaignsTab.loading')}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="h-16 w-16 text-on-surface-variant/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-on-surface mb-2">{t('emailMarketing.campaignsTab.emptyTitle')}</h3>
            <p className="text-on-surface-variant mb-4">
              {searchQuery ? t('emailMarketing.campaignsTab.emptySubtitleSearch') : t('emailMarketing.campaignsTab.emptySubtitleDefault')}
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors"
            >
              {t('emailMarketing.page.createCampaign')}
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <div className="divide-y divide-outline-variant/20">
            {filteredCampaigns.map((campaign: EmailCampaign) => (
              <div key={campaign.id} className="p-4 sm:p-6 hover:bg-surface-container-high transition-colors">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base sm:text-lg font-semibold text-on-surface truncate mb-1.5">
                      {campaign.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 ${getStatusColor(campaign.status)}`}>
                        {getStatusIcon(campaign.status)}
                        <span>{statusLabel(campaign.status, t)}</span>
                      </span>
                      <span className="px-2 py-1 text-xs font-medium bg-secondary/15 text-secondary rounded capitalize">
                        {campaign.type}
                      </span>
                      {campaign.status === 'scheduled' && campaign.scheduledAt && (
                        <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(campaign.scheduledAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-sm mb-3 line-clamp-2">
                      {campaign.subject}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant">
                      <span className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{t('emailMarketing.campaignsTab.recipients', { count: campaign.totalRecipients })}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Eye className="h-4 w-4" />
                        <span>{t('emailMarketing.campaignsTab.openRateValue', { rate: calculateOpenRate(campaign) })}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <MousePointer2 className="h-4 w-4" />
                        <span>{t('emailMarketing.campaignsTab.clickRateValue', { rate: calculateClickRate(campaign) })}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(campaign.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:shrink-0">
                    {canSend(campaign) && (
                      <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-secondary hover:bg-secondary/10 rounded" onClick={() => onSend(campaign)} title={t('emailMarketing.campaignsTab.send')} aria-label={t('emailMarketing.campaignsTab.send')}>
                        <Send className="h-4 w-4" />
                        <span className="sm:hidden">{t('emailMarketing.campaignsTab.send')}</span>
                      </button>
                    )}
                    <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded" onClick={() => onEdit(campaign)} title={t('common.edit')} aria-label={t('common.edit')}>
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-on-surface-variant hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" onClick={() => onDelete(campaign.id)} title={t('common.delete')} aria-label={t('common.delete')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((campaign: EmailCampaign) => (
                <div key={campaign.id} className="bg-surface-container-high rounded-lg p-4 sm:p-6 hover:shadow-lg transition-shadow">
                  <div className="mb-4 min-w-0">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded items-center gap-1 ${getStatusColor(campaign.status)}`}>
                      {getStatusIcon(campaign.status)}
                      <span>{statusLabel(campaign.status, t)}</span>
                    </span>
                    <h4 className="text-lg font-semibold text-on-surface mt-2 truncate">
                      {campaign.name}
                    </h4>
                  </div>
                  <p className="text-on-surface-variant text-sm mb-4 line-clamp-2">
                    {campaign.subject}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-2xl font-bold text-secondary">
                        {calculateOpenRate(campaign)}%
                      </div>
                      <div className="text-xs text-on-surface-variant">{t('emailMarketing.campaignsTab.openRateLabel')}</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {calculateClickRate(campaign)}%
                      </div>
                      <div className="text-xs text-on-surface-variant">{t('emailMarketing.campaignsTab.clickRateLabel')}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canSend(campaign) && (
                      <button className="flex-1 px-4 py-2 text-sm border border-outline-variant/40 rounded hover:bg-surface-container-high" onClick={() => onSend(campaign)}>
                        {t('emailMarketing.campaignsTab.send')}
                      </button>
                    )}
                    <button className="flex-1 px-4 py-2 text-sm bg-secondary text-on-secondary rounded hover:opacity-90" onClick={() => onEdit(campaign)}>
                      {t('common.edit')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

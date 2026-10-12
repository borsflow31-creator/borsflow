/**
 * Email Marketing Page
 * 
 * Main page for email marketing functionality including campaigns,
 * templates, segments, and analytics with full API integration.
 */

'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import NoWorkspace from '@/components/NoWorkspace'
import { useAppStore } from '@/store/appStore'
import CampaignModal from '@/components/email-marketing/CampaignModal'
import TemplateModal from '@/components/email-marketing/TemplateModal'
import SegmentModal from '@/components/email-marketing/SegmentModal'
import ProviderModal from '@/components/email-marketing/ProviderModal'
import AutomationModal from '@/components/email-marketing/AutomationModal'
import CampaignsTab from '@/components/email-marketing/tabs/CampaignsTab'
import TemplatesTab from '@/components/email-marketing/tabs/TemplatesTab'
import AutomationsTab from '@/components/email-marketing/tabs/AutomationsTab'
import SettingsTab from '@/components/email-marketing/tabs/SettingsTab'
import type {
  EmailCampaign,
  EmailTemplate,
  SegmentationRule,
  EmailProvider,
  EmailAutomation,
} from '@/components/email-marketing/types'
import { useI18n } from '@/i18n/I18nProvider'
import { Mail, Send, FileText, Zap, Settings, Plus, RefreshCw } from 'lucide-react'
import { cachedJson, CachedFetchError } from '@/lib/client-cache'

/**
 * Tabs that no longer exist, and where their contents went. Links, bookmarks and
 * the `/templates` page all point at `?tab=` values, so a retired name resolves
 * to the tab that absorbed it rather than showing an empty page.
 */
const RETIRED_TABS: Record<string, { tab: string; section?: string }> = {
  segments: { tab: 'settings', section: 'audiences' },
  providers: { tab: 'settings', section: 'sending' },
  analytics: { tab: 'campaigns' },
}

const resolveTab = (requested: string | null): string => {
  const name = requested || 'campaigns'
  return RETIRED_TABS[name]?.tab ?? name
}

function EmailMarketingPageInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentWorkspaceId, setWorkspace } = useAppStore()
  const { t } = useI18n()

  const [activeTab, setActiveTabState] = useState(() => resolveTab(searchParams.get('tab')))
  // Keep the tab in the URL so refresh/back/share land on the same tab
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }
  const workspaceId = currentWorkspaceId || ''
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [segments, setSegments] = useState<SegmentationRule[]>([])
  const [providers, setProviders] = useState<EmailProvider[]>([])
  const [automations, setAutomations] = useState<EmailAutomation[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showSegmentModal, setShowSegmentModal] = useState(false)
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [showAutomationModal, setShowAutomationModal] = useState(false)

  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<SegmentationRule | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null)
  const [selectedAutomation, setSelectedAutomation] = useState<EmailAutomation | null>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const tabs = [
    { id: 'campaigns', label: t('emailMarketing.tabs.campaigns'), icon: Send },
    { id: 'templates', label: t('emailMarketing.tabs.templates'), icon: FileText },
    { id: 'automations', label: t('emailMarketing.tabs.automations'), icon: Zap },
    { id: 'settings', label: t('emailMarketing.tabs.settings'), icon: Settings },
  ]

  useEffect(() => {
    if (workspaceId) {
      fetchData(workspaceId, true)
    }
  }, [workspaceId])

  // An old link named a tab that is now a section of Settings; once the lists
  // have loaded and the section exists, take the reader to it.
  useEffect(() => {
    const section = RETIRED_TABS[searchParams.get('tab') || '']?.section
    if (!section || loading) return
    document.getElementById(section)?.scrollIntoView({ block: 'start' })
  }, [searchParams, loading])

  // Open edit modal when coming from /templates page with ?editTemplate=<id>
  useEffect(() => {
    const editTemplateId = searchParams.get('editTemplate')
    if (!editTemplateId || templates.length === 0) return
    const match = templates.find((t) => t.id === editTemplateId)
    if (match) {
      setSelectedTemplate(match)
      setShowTemplateModal(true)
    }
  }, [templates, searchParams])

  const fetchData = async (wsId: string, validateWorkspace = false) => {
    if (initialLoad) setLoading(true)
    try {
      // On first load, verify the workspace still exists (guards against stale
      // persisted IDs). Shares the shell's cached request and runs alongside the
      // list fetches instead of before them.
      if (validateWorkspace) {
        cachedJson(`/api/workspaces/${wsId}`).catch((err: unknown) => {
          if (err instanceof CachedFetchError && err.status === 404) setWorkspace(null)
        })
      }

      // Load every tab's list in parallel; one failing list doesn't block the others
      const load = async (path: string, key: string, set: (v: any[]) => void) => {
        const res = await fetch(`/api/email-marketing/${path}?workspaceId=${wsId}`)
        if (res.ok) set((await res.json())[key] || [])
      }
      await Promise.allSettled([
        load('campaigns', 'campaigns', setCampaigns),
        load('templates', 'templates', setTemplates),
        load('segments', 'segments', setSegments),
        load('providers', 'providers', setProviders),
        load('automations', 'automations', setAutomations),
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }

  const handleSaveAutomation = async (automation: any) => {
    const isEdit = !!selectedAutomation
    const res = await fetch(`/api/email-marketing/automations${isEdit ? '/' + selectedAutomation!.id : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...automation, workspaceId })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || t('emailMarketing.automationsTab.saveFailed'))
      return
    }
    setShowAutomationModal(false)
    setSelectedAutomation(null)
    fetchData(workspaceId)
  }

  const handleToggleAutomation = async (automation: EmailAutomation) => {
    // Pausing is how you edit a running sequence, so surface why activation failed.
    const nextStatus = automation.status === 'active' ? 'paused' : 'active'
    const res = await fetch(`/api/email-marketing/automations/${automation.id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || t('emailMarketing.automationsTab.toggleFailed'))
      return
    }
    fetchData(workspaceId)
  }

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm(t('emailMarketing.automationsTab.deleteConfirm'))) return
    const res = await fetch(`/api/email-marketing/automations/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || t('emailMarketing.automationsTab.deleteFailed'))
      return
    }
    fetchData(workspaceId)
  }

  const handleSaveCampaign = async (campaign: any) => {
    const isEdit = !!selectedCampaign;
    const res = await fetch(`/api/email-marketing/campaigns${isEdit ? '/' + selectedCampaign!.id : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...campaign, workspaceId })
    });
    const data = await res.json().catch(() => ({}));
    // Throwing keeps the modal open and shows the error there
    if (!res.ok) throw new Error(data.error || t('emailMarketing.campaignsTab.saveFailed'));
    setShowCampaignModal(false);
    fetchData(workspaceId);
  }

  const handleSaveTemplate = async (template: any) => {
    const isEdit = !!selectedTemplate;
    const res = await fetch(`/api/email-marketing/templates${isEdit ? '/' + selectedTemplate!.id : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...template, workspaceId })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || t('emailMarketing.templatesTab.saveFailed'));
    }
    setShowTemplateModal(false);
    fetchData(workspaceId);
  }

  const handleSaveSegment = async (segment: any) => {
    const isEdit = !!selectedSegment;
    const res = await fetch(`/api/email-marketing/segments${isEdit ? '/' + selectedSegment!.id : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...segment, workspaceId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('emailMarketing.segmentsTab.saveFailed'));
    setShowSegmentModal(false);
    fetchData(workspaceId);
  }

  const handleSaveProvider = async (provider: any) => {
    const isEdit = !!selectedProvider;
    const res = await fetch(`/api/email-marketing/providers${isEdit ? '/' + selectedProvider!.id : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...provider, workspaceId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('emailMarketing.providersTab.saveFailed'));
    setShowProviderModal(false);
    fetchData(workspaceId);
  }

  const handleDeleteCampaign = async (id: string) => {
    if (confirm(t('emailMarketing.campaignsTab.deleteConfirm'))) {
      const res = await fetch(`/api/email-marketing/campaigns/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || t('emailMarketing.campaignsTab.deleteFailed')); return; }
      fetchData(workspaceId);
    }
  }

  const handleSendCampaign = async (campaign: EmailCampaign) => {
    const question = campaign.status === 'scheduled' && campaign.scheduledAt
      ? t('emailMarketing.campaignsTab.sendNowConfirm', { date: new Date(campaign.scheduledAt).toLocaleString() })
      : t('emailMarketing.campaignsTab.sendConfirm')
    if (!confirm(question)) return
    const res = await fetch(`/api/email-marketing/campaigns/${campaign.id}/send`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || t('emailMarketing.campaignsTab.sendFailed'));
    }
    fetchData(workspaceId);
  }

  const handleDeleteTemplate = async (id: string) => {
    if (confirm(t('emailMarketing.templatesTab.deleteConfirm'))) {
      const res = await fetch(`/api/email-marketing/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || t('emailMarketing.templatesTab.deleteFailed')); return; }
      fetchData(workspaceId);
    }
  }

  const handleDeleteSegment = async (id: string) => {
    if (confirm(t('emailMarketing.segmentsTab.deleteConfirm'))) {
      const res = await fetch(`/api/email-marketing/segments/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || t('emailMarketing.segmentsTab.deleteFailed')); return; }
      fetchData(workspaceId);
    }
  }

  const handleRetryTracking = async (id: string) => {
    const res = await fetch(`/api/email-marketing/providers/${id}/tracking`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || t('emailMarketing.providersTab.retryFailed'));
    }
    fetchData(workspaceId);
  }

  // Sends a test email through a saved provider (server uses the stored key)
  const handleTestProvider = async (provider: EmailProvider): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/email-marketing/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: provider.id }),
      })
      const data = await res.json().catch(() => ({}))
      return data.success
        ? { success: true, message: t('emailMarketing.providersTab.testSent', { email: provider.fromEmail }) }
        : { success: false, message: t('emailMarketing.providersTab.testFailed', { error: data.error || res.statusText }) }
    } catch {
      return { success: false, message: t('emailMarketing.providerModal.testFailedGeneric') }
    }
  }

  const handleDeleteProvider = async (id: string) => {
    if (confirm(t('emailMarketing.providersTab.deleteConfirm'))) {
      const res = await fetch(`/api/email-marketing/providers/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || t('emailMarketing.providersTab.deleteFailed')); return; }
      fetchData(workspaceId);
    }
  }

  const handleCloneStarterTemplate = async (template: {
    name: string
    description: string
    type: string
    subject: string
    htmlContent: string
    textContent: string
    variables: string[]
    tags: string[]
  }) => {
    const res = await fetch('/api/email-marketing/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        name: template.name,
        description: template.description,
        type: template.type,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        variables: template.variables,
        tags: template.tags,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || t('emailMarketing.templatesTab.cloneFailed'))
    }

    await fetchData(workspaceId)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    )
  }

  if (!workspaceId) return <NoWorkspace />;

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-surface-container-low border-b border-outline-variant/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center gap-3 h-16">
              <div className="flex min-w-0 items-center gap-3">
                <Mail className="h-6 w-6 shrink-0 text-secondary" />
                <h1 className="truncate text-lg sm:text-xl font-semibold text-on-surface">
                  {t('emailMarketing.page.title')}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={async () => { setRefreshing(true); try { await fetchData(workspaceId) } finally { setRefreshing(false) } }}
                  disabled={refreshing}
                  className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-60"
                  title={t('emailMarketing.page.refresh')}
                  aria-label={t('emailMarketing.page.refresh')}
                >
                  <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                {activeTab === 'campaigns' && (
                  <button onClick={() => { setSelectedCampaign(null); setShowCampaignModal(true); }} className="px-3 sm:px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('emailMarketing.page.createCampaign')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-surface-container-low border-b border-outline-variant/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Scrolls sideways on narrow screens instead of overflowing the page */}
            <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:gap-6 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-2 py-4 sm:px-0 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-secondary text-secondary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="text-sm sm:text-base font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeTab === 'campaigns' && (
            <CampaignsTab
              campaigns={campaigns}
              loading={loading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              viewMode={viewMode}
              setViewMode={setViewMode}
              onCreate={() => { setSelectedCampaign(null); setShowCampaignModal(true); }}
              onEdit={(c) => { setSelectedCampaign(c); setShowCampaignModal(true); }}
              onDelete={handleDeleteCampaign}
              onSend={handleSendCampaign}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesTab
              workspaceId={workspaceId}
              templates={templates}
              loading={loading}
              onCloneStarter={handleCloneStarterTemplate}
              onEdit={(template) => { setSelectedTemplate(template); setShowTemplateModal(true); }}
              onCreate={() => { setSelectedTemplate(null); setShowTemplateModal(true); }}
              onDelete={handleDeleteTemplate}
            />
          )}
          {activeTab === 'automations' && (
            <AutomationsTab
              automations={automations}
              loading={loading}
              onCreate={() => { setSelectedAutomation(null); setShowAutomationModal(true); }}
              onEdit={(a) => { setSelectedAutomation(a); setShowAutomationModal(true); }}
              onToggle={handleToggleAutomation}
              onDelete={handleDeleteAutomation}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsTab
              segments={segments}
              providers={providers}
              loading={loading}
              onEditSegment={(s) => { setSelectedSegment(s); setShowSegmentModal(true); }}
              onCreateSegment={() => { setSelectedSegment(null); setShowSegmentModal(true); }}
              onDeleteSegment={handleDeleteSegment}
              onEditProvider={(p) => { setSelectedProvider(p); setShowProviderModal(true); }}
              onCreateProvider={() => { setSelectedProvider(null); setShowProviderModal(true); }}
              onTestProvider={handleTestProvider}
              onDeleteProvider={handleDeleteProvider}
              onRetryTracking={handleRetryTracking}
            />
          )}
        </div>
      </div>

      {showCampaignModal && (
        <CampaignModal
          campaign={selectedCampaign}
          isOpen={showCampaignModal}
          onClose={() => setShowCampaignModal(false)}
          onSave={handleSaveCampaign}
          workspaceId={workspaceId}
          templates={templates}
          segments={segments}
        />
      )}

      {showTemplateModal && (
        <TemplateModal
          template={selectedTemplate}
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onSave={handleSaveTemplate}
          workspaceId={workspaceId}
        />
      )}

      {showSegmentModal && (
        <SegmentModal
          segment={selectedSegment}
          isOpen={showSegmentModal}
          onClose={() => setShowSegmentModal(false)}
          onSave={handleSaveSegment}
          workspaceId={workspaceId}
        />
      )}

      {showAutomationModal && (
        <AutomationModal
          automation={selectedAutomation}
          isOpen={showAutomationModal}
          onClose={() => { setShowAutomationModal(false); setSelectedAutomation(null); }}
          onSave={handleSaveAutomation}
          workspaceId={workspaceId}
          templates={templates}
        />
      )}

      {showProviderModal && (
        <ProviderModal
          provider={selectedProvider}
          isOpen={showProviderModal}
          onClose={() => setShowProviderModal(false)}
          onSave={handleSaveProvider}
          workspaceId={workspaceId}
        />
      )}
    </AppShell>
  )
}

export default function EmailMarketingPage() {
  return (
    <Suspense fallback={null}>
      <EmailMarketingPageInner />
    </Suspense>
  )
}

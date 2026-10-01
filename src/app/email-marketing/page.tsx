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
import EmailStarterTemplateGallery from '@/components/email-marketing/EmailStarterTemplateGallery'
import TemplateModal from '@/components/email-marketing/TemplateModal'
import SegmentModal from '@/components/email-marketing/SegmentModal'
import ProviderModal from '@/components/email-marketing/ProviderModal'
import AutomationModal from '@/components/email-marketing/AutomationModal'
import { useI18n, type MessageKey } from '@/i18n/I18nProvider'
import {
  Mail, 
  Send, 
  FileText, 
  Users, 
  BarChart3, 
  Settings,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer2,
  Zap,
  Calendar,
  Tag,
  Target,
  LayoutGrid,
  List,
  RefreshCw,
  Server
} from 'lucide-react'

// Types based on Prisma schema
interface EmailCampaign {
  id: string
  name: string
  description?: string
  type: string
  status: string
  subject: string
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  scheduledAt?: string
  createdAt: string
}

interface EmailTemplate {
  id: string
  name: string
  description?: string
  type: string
  subject: string
  htmlContent?: string
  textContent?: string
  variables?: string
  tags?: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

interface SegmentationRule {
  id: string
  name: string
  description?: string
  isActive: boolean
  estimatedSize?: number
  createdAt: string
}

interface EmailProvider {
  id: string
  name: string
  type: string
  fromEmail: string
  isActive: boolean
  isDefault: boolean
  dailyLimit?: number
  // Bounce/complaint webhook BorsFlow sets up on the provider account by itself
  webhookStatus?: 'active' | 'error' | 'unsupported' | 'waiting_public_url' | null
  webhookError?: string | null
}

interface EmailAutomation {
  id: string
  name: string
  description?: string
  type: string
  status: string
  totalEnrolled: number
  activeEnrolled: number
  completedCount: number
  triggers: Array<{ id: string; type: string; conditions: string; isActive: boolean }>
  steps: Array<{ id: string; order: number; name: string; delayMinutes: number; templateId?: string | null; template?: { id: string; name: string } | null }>
  createdAt: string
  updatedAt: string
}

function EmailMarketingPageInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentWorkspaceId, setWorkspace } = useAppStore()
  const { t } = useI18n()

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'campaigns')
  const workspaceId = currentWorkspaceId || ''
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [segments, setSegments] = useState<SegmentationRule[]>([])
  const [providers, setProviders] = useState<EmailProvider[]>([])
  const [automations, setAutomations] = useState<EmailAutomation[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
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
    { id: 'segments', label: t('emailMarketing.tabs.segments'), icon: Users },
    { id: 'automations', label: t('emailMarketing.tabs.automations'), icon: Zap },
    { id: 'analytics', label: t('emailMarketing.tabs.analytics'), icon: BarChart3 },
    { id: 'providers', label: t('emailMarketing.tabs.providers'), icon: Settings },
  ]

  useEffect(() => {
    if (workspaceId) {
      fetchData(workspaceId, true)
    }
  }, [workspaceId])

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
      // On first load, verify the workspace still exists (guards against stale persisted IDs)
      if (validateWorkspace) {
        const wsCheck = await fetch(`/api/workspaces/${wsId}`)
        if (wsCheck.status === 404) {
          setWorkspace(null)
          setLoading(false)
          return
        }
      }

      // Fetch campaigns
      const campaignsRes = await fetch(`/api/email-marketing/campaigns?workspaceId=${wsId}`)
      if (campaignsRes.ok) {
        const data = await campaignsRes.json()
        setCampaigns(data.campaigns || [])
      }

      // Fetch templates
      const templatesRes = await fetch(`/api/email-marketing/templates?workspaceId=${wsId}`)
      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data.templates || [])
      }

      // Fetch segments
      const segmentsRes = await fetch(`/api/email-marketing/segments?workspaceId=${wsId}`)
      if (segmentsRes.ok) {
        const data = await segmentsRes.json()
        setSegments(data.segments || [])
      }

      // Fetch providers
      const providersRes = await fetch(`/api/email-marketing/providers?workspaceId=${wsId}`)
      if (providersRes.ok) {
        const data = await providersRes.json()
        setProviders(data.providers || [])
      }

      // Fetch automations
      const automationsRes = await fetch(`/api/email-marketing/automations?workspaceId=${wsId}`)
      if (automationsRes.ok) {
        const data = await automationsRes.json()
        setAutomations(data.automations || [])
      }
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
    try {
      const isEdit = !!selectedCampaign;
      const res = await fetch(`/api/email-marketing/campaigns${isEdit ? '/' + selectedCampaign.id : ''}`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campaign, workspaceId })
      });
      if (res.ok) {
        setShowCampaignModal(false);
        fetchData(workspaceId);
      }
    } catch (e) {
      console.error(e)
    }
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
      if (!res.ok) { alert(t('emailMarketing.campaignsTab.deleteFailed')); return; }
      fetchData(workspaceId);
    }
  }

  const handleSendCampaign = async (id: string) => {
    if (confirm(t('emailMarketing.campaignsTab.sendConfirm'))) {
      await fetch(`/api/email-marketing/campaigns/${id}/send`, { method: 'POST' });
      fetchData(workspaceId);
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (confirm(t('emailMarketing.templatesTab.deleteConfirm'))) {
      const res = await fetch(`/api/email-marketing/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert(t('emailMarketing.templatesTab.deleteFailed')); return; }
      fetchData(workspaceId);
    }
  }

  const handleDeleteSegment = async (id: string) => {
    if (confirm(t('emailMarketing.segmentsTab.deleteConfirm'))) {
      const res = await fetch(`/api/email-marketing/segments/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert(t('emailMarketing.segmentsTab.deleteFailed')); return; }
      fetchData(workspaceId);
    }
  }

  const handleRetryTracking = async (id: string) => {
    await fetch(`/api/email-marketing/providers/${id}/tracking`, { method: 'POST' });
    fetchData(workspaceId);
  }

  const handleDeleteProvider = async (id: string) => {
    if (confirm(t('emailMarketing.providersTab.deleteConfirm'))) {
      const res = await fetch(`/api/email-marketing/providers/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert(t('emailMarketing.providersTab.deleteFailed')); return; }
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

  const handleEditStarterTemplate = async (template: {
    name: string
    description: string
    type: string
    subject: string
    htmlContent: string
    textContent: string
    variables: string[]
    tags: string[]
  }) => {
    // Clone the starter template into the workspace first
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
    if (!res.ok) throw new Error(data.error || t('emailMarketing.templatesTab.cloneForEditFailed'))

    // Open the newly cloned template in the editor
    const cloned = data.template
    setSelectedTemplate(cloned)
    setShowTemplateModal(true)

    // Refresh list in background
    fetchData(workspaceId)
  }

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
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Mail className="h-6 w-6 text-secondary" />
                <h1 className="text-xl font-semibold text-on-surface">
                  {t('emailMarketing.page.title')}
                </h1>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => fetchData(workspaceId)}
                  className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
                  title={t('emailMarketing.page.refresh')}
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
                <button onClick={() => { setSelectedCampaign(null); setShowCampaignModal(true); }} className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>{t('emailMarketing.page.createCampaign')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-surface-container-low border-b border-outline-variant/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-secondary text-secondary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'campaigns' && (
            <CampaignsContent 
              campaigns={campaigns}
              loading={loading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              viewMode={viewMode}
              setViewMode={setViewMode}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              calculateOpenRate={calculateOpenRate}
              calculateClickRate={calculateClickRate}
              onCreate={() => { setSelectedCampaign(null); setShowCampaignModal(true); }}
              onEdit={(c) => { setSelectedCampaign(c); setShowCampaignModal(true); }}
              onDelete={handleDeleteCampaign}
              onSend={handleSendCampaign}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesContent
              workspaceId={workspaceId}
              templates={templates}
              loading={loading}
              onCloneStarter={handleCloneStarterTemplate}
              onEditStarter={handleEditStarterTemplate}
              onEdit={(t) => { setSelectedTemplate(t); setShowTemplateModal(true); }}
              onCreate={() => { setSelectedTemplate(null); setShowTemplateModal(true); }}
              onDelete={handleDeleteTemplate}
            />
          )}
          {activeTab === 'segments' && (
            <SegmentsContent
              segments={segments}
              loading={loading}
              onEdit={(s) => { setSelectedSegment(s); setShowSegmentModal(true); }}
              onCreate={() => { setSelectedSegment(null); setShowSegmentModal(true); }}
              onDelete={handleDeleteSegment}
            />
          )}
          {activeTab === 'automations' && (
            <AutomationsContent
              automations={automations}
              loading={loading}
              onCreate={() => { setSelectedAutomation(null); setShowAutomationModal(true); }}
              onEdit={(a) => { setSelectedAutomation(a); setShowAutomationModal(true); }}
              onToggle={handleToggleAutomation}
              onDelete={handleDeleteAutomation}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsContent 
              campaigns={campaigns}
            />
          )}
          {activeTab === 'providers' && (
            <ProvidersContent
              providers={providers}
              loading={loading}
              onEdit={(p: any) => { setSelectedProvider(p); setShowProviderModal(true); }}
              onCreate={() => { setSelectedProvider(null); setShowProviderModal(true); }}
              onTest={(p: any) => { setSelectedProvider(p); setShowProviderModal(true); }}
              onDelete={handleDeleteProvider}
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

function CampaignsContent({
  campaigns,
  loading,
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  getStatusColor,
  getStatusIcon,
  calculateOpenRate,
  calculateClickRate,
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
  getStatusColor: (status: string) => string
  getStatusIcon: (status: string) => React.ReactNode
  calculateOpenRate: (c: EmailCampaign) => string | number
  calculateClickRate: (c: EmailCampaign) => string | number
  onCreate: () => void
  onEdit: (c: EmailCampaign) => void
  onDelete: (id: string) => void
  onSend: (id: string) => void
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
    avgOpenRate: campaigns.length > 0 
      ? (campaigns.reduce((acc, c) => acc + parseFloat(String(calculateOpenRate(c))), 0) / campaigns.length).toFixed(1)
      : '0.0'
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.campaignsTab.heading')}
        </h2>
        <p className="text-on-surface-variant">
          {t('emailMarketing.campaignsTab.subtitle')}
        </p>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-secondary">
              {stats.active}
            </div>
            <Send className="h-8 w-8 text-secondary/20" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.campaignsTab.statActive')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-green-600">
              {stats.avgOpenRate}%
            </div>
            <TrendingUp className="h-8 w-8 text-green-200 dark:text-green-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.campaignsTab.statAvgOpenRate')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-blue-600">
              {campaigns.reduce((acc, c) => acc + c.sentCount, 0).toLocaleString()}
            </div>
            <Mail className="h-8 w-8 text-blue-200 dark:text-blue-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.campaignsTab.statTotalSent')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-purple-600">
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
        <div className="p-6 border-b border-outline-variant/20">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-on-surface">
              {t('emailMarketing.campaignsTab.listHeading', { count: filteredCampaigns.length })}
            </h3>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder={t('emailMarketing.campaignsTab.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-1 border-l border-outline-variant/40 pl-3">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-secondary/15 text-secondary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <List className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
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
              <div key={campaign.id} className="p-6 hover:bg-surface-container-high transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded flex items-center space-x-1 ${getStatusColor(campaign.status)}`}>
                        {getStatusIcon(campaign.status)}
                        <span className="capitalize">{campaign.status}</span>
                      </span>
                      <span className="px-2 py-1 text-xs font-medium bg-secondary/15 text-secondary rounded capitalize">
                        {campaign.type}
                      </span>
                      <h4 className="text-lg font-semibold text-on-surface">
                        {campaign.name}
                      </h4>
                    </div>
                    <p className="text-on-surface-variant text-sm mb-3">
                      {campaign.subject}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
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
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded" onClick={() => onSend(campaign.id)}>
                      <Send className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded" onClick={() => onEdit(campaign)}>
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded" onClick={() => onDelete(campaign.id)}>
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
                <div key={campaign.id} className="bg-surface-container-high rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded flex items-center space-x-1 ${getStatusColor(campaign.status)}`}>
                        {getStatusIcon(campaign.status)}
                        <span className="capitalize">{campaign.status}</span>
                      </span>
                      <h4 className="text-lg font-semibold text-on-surface mt-2">
                        {campaign.name}
                      </h4>
                    </div>
                    <button className="p-1 text-on-surface-variant hover:text-on-surface">
                      <MoreVertical className="h-5 w-5" />
                    </button>
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
                  <div className="flex space-x-2">
                    <button className="flex-1 px-4 py-2 text-sm border border-outline-variant/40 rounded hover:bg-surface-container-high" onClick={() => onSend(campaign.id)}>
                      {t('emailMarketing.campaignsTab.send')}
                    </button>
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

function TemplatesContent({
  workspaceId,
  templates,
  loading,
  onCloneStarter,
  onEditStarter,
  onEdit,
  onCreate,
  onDelete,
}: {
  workspaceId: string
  templates: EmailTemplate[]
  loading: boolean
  onCloneStarter: (template: {
    name: string
    description: string
    type: string
    subject: string
    htmlContent: string
    textContent: string
    variables: string[]
    tags: string[]
  }) => Promise<void>
  onEditStarter: (template: {
    name: string
    description: string
    type: string
    subject: string
    htmlContent: string
    textContent: string
    variables: string[]
    tags: string[]
  }) => Promise<void>
  onEdit: (t: EmailTemplate) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.templatesTab.heading')}
        </h2>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-12 text-center text-on-surface-variant shadow-sm">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          {t('emailMarketing.templatesTab.loading')}
        </div>
      ) : (
        <div className="space-y-8">
          <EmailStarterTemplateGallery
            workspaceId={workspaceId}
            workspaceTemplates={templates}
            onCloneTemplate={onCloneStarter}
            onEditStarter={onEditStarter}
            onCreateBlank={onCreate}
            onEditWorkspaceTemplate={onEdit}
            onDeleteWorkspaceTemplate={onDelete}
          />
        </div>
      )}
    </div>
  )
}

type TFunction = (key: MessageKey, values?: Record<string, string | number>) => string

function describeTrigger(automation: EmailAutomation, t: TFunction): string {
  const trigger = automation.triggers?.[0]
  if (!trigger) return t('emailMarketing.automationsTab.noTrigger')
  try {
    const c = JSON.parse(trigger.conditions)
    if (!c?.toStage) return t('emailMarketing.automationsTab.noTrigger')
    if (c.fromStage) {
      return t('emailMarketing.automationsTab.triggerMovesFrom', { fromStage: c.fromStage, toStage: c.toStage })
    }
    return t('emailMarketing.automationsTab.triggerMoves', { toStage: c.toStage })
  } catch {
    return t('emailMarketing.automationsTab.invalidTrigger')
  }
}

function describeSchedule(automation: EmailAutomation, t: TFunction): string {
  const steps = automation.steps || []
  if (steps.length === 0) return t('emailMarketing.automationsTab.noSteps')
  const total = steps.reduce((acc, s) => acc + (s.delayMinutes || 0), 0)
  const label = steps.length === 1 ? t('emailMarketing.automationsTab.oneEmail') : t('emailMarketing.automationsTab.emailsCount', { count: steps.length })
  if (total === 0) return t('emailMarketing.automationsTab.allSentImmediately', { label })
  if (total < 60) return t('emailMarketing.automationsTab.overMinutes', { label, minutes: total })
  if (total < 60 * 24) return t('emailMarketing.automationsTab.overHours', { label, hours: Math.round(total / 60) })
  return t('emailMarketing.automationsTab.overDays', { label, days: Math.round(total / (60 * 24)) })
}

function AutomationsContent({ automations, loading, onCreate, onEdit, onToggle, onDelete }: {
  automations: EmailAutomation[]
  loading: boolean
  onCreate: () => void
  onEdit: (a: EmailAutomation) => void
  onToggle: (a: EmailAutomation) => void
  onDelete: (id: string) => void
}) {
  const { t } = useI18n()
  const active = automations.filter(a => a.status === 'active')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.automationsTab.heading')}
        </h2>
        <p className="text-on-surface-variant">
          {t('emailMarketing.automationsTab.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-secondary">{automations.length}</div>
            <Zap className="h-8 w-8 text-secondary/20" />
          </div>
          <div className="text-on-surface-variant">{t('emailMarketing.automationsTab.statAutomations')}</div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-green-600">{active.length}</div>
            <Play className="h-8 w-8 text-green-200 dark:text-green-900/40" />
          </div>
          <div className="text-on-surface-variant">{t('emailMarketing.automationsTab.statRunning')}</div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-blue-600">
              {automations.reduce((acc, a) => acc + (a.activeEnrolled || 0), 0).toLocaleString()}
            </div>
            <Users className="h-8 w-8 text-blue-200 dark:text-blue-900/40" />
          </div>
          <div className="text-on-surface-variant">{t('emailMarketing.automationsTab.statLeadsInSequence')}</div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-lg shadow">
        <div className="p-6 border-b border-outline-variant/20">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-on-surface">
              {t('emailMarketing.automationsTab.listHeading', { count: automations.length })}
            </h3>
            <button className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              <span>{t('emailMarketing.automationsTab.createAutomation')}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-on-surface-variant">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            {t('emailMarketing.automationsTab.loading')}
          </div>
        ) : automations.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="h-16 w-16 text-on-surface-variant/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-on-surface mb-2">{t('emailMarketing.automationsTab.emptyTitle')}</h3>
            <p className="text-on-surface-variant mb-4">
              {t('emailMarketing.automationsTab.emptySubtitle')}
            </p>
            <button className="px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors" onClick={onCreate}>
              {t('emailMarketing.automationsTab.createAutomation')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {automations.map((automation) => (
              <div key={automation.id} className="p-6 hover:bg-surface-container-high transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-base font-medium text-on-surface truncate">{automation.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        automation.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : automation.status === 'paused'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400'
                      }`}>
                        {automation.status}
                      </span>
                    </div>
                    {automation.description && (
                      <p className="text-sm text-on-surface-variant mb-2 truncate">{automation.description}</p>
                    )}
                    <p className="text-sm text-on-surface-variant">{describeTrigger(automation, t)}</p>
                    <p className="text-sm text-on-surface-variant mt-1">
                      {describeSchedule(automation, t)}
                      {' \u00b7 '}
                      {t('emailMarketing.automationsTab.activeCount', { count: automation.activeEnrolled || 0 })}
                      {' \u00b7 '}
                      {t('emailMarketing.automationsTab.completedCount', { count: automation.completedCount || 0 })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onToggle(automation)}
                      className="p-2 text-on-surface-variant hover:text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                      title={automation.status === 'active' ? t('emailMarketing.automationsTab.pause') : t('emailMarketing.automationsTab.activate')}
                    >
                      {automation.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => onEdit(automation)}
                      className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
                      title={t('common.edit')}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(automation.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
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

function SegmentsContent({ segments, loading, onEdit, onCreate, onDelete }: { segments: SegmentationRule[]; loading: boolean; onEdit: (s: SegmentationRule) => void; onCreate: () => void; onDelete: (id: string) => void }) {
  const { t } = useI18n()
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.segmentsTab.heading')}
        </h2>
        <p className="text-on-surface-variant">
          {t('emailMarketing.segmentsTab.subtitle')}
        </p>
      </div>

      {/* Segment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-secondary">
              {segments.length}
            </div>
            <Users className="h-8 w-8 text-secondary/20" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.segmentsTab.statActiveSegments')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-green-600">
              {segments.reduce((acc, s) => acc + (s.estimatedSize || 0), 0).toLocaleString()}
            </div>
            <Target className="h-8 w-8 text-green-200 dark:text-green-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.segmentsTab.statTotalLeads')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-blue-600">
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
        <div className="p-6 border-b border-outline-variant/20">
          <div className="flex justify-between items-center">
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
              <div key={segment.id} className="p-6 hover:bg-surface-container-high transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-on-surface">
                        {segment.name}
                      </h4>
                      {segment.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          {t('emailMarketing.segmentsTab.active')}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-surface-container-highest text-on-surface-variant rounded">
                          {t('emailMarketing.segmentsTab.inactive')}
                        </span>
                      )}
                      {segment.estimatedSize && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
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
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1.5 text-sm border border-outline-variant/40 rounded hover:bg-surface-container-high" onClick={() => onEdit(segment)}>
                      {t('common.edit')}
                    </button>
                    <button className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50" onClick={() => onDelete(segment.id)}>
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

function AnalyticsContent({ campaigns }: { campaigns: EmailCampaign[] }) {
  const { t } = useI18n()
  const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0)
  const totalDelivered = campaigns.reduce((acc, c) => acc + c.deliveredCount, 0)
  const totalOpened = campaigns.reduce((acc, c) => acc + c.openedCount, 0)
  const totalClicked = campaigns.reduce((acc, c) => acc + c.clickedCount, 0)
  const totalBounced = campaigns.reduce((acc, c) => acc + c.bouncedCount, 0)

  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0'
  const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : '0.0'
  const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : '0.0'

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const rateA = a.sentCount > 0 ? (a.openedCount / a.sentCount) * 100 : 0
    const rateB = b.sentCount > 0 ? (b.openedCount / b.sentCount) * 100 : 0
    return rateB - rateA
  }).slice(0, 5)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.analyticsTab.heading')}
        </h2>
        <p className="text-on-surface-variant">
          {t('emailMarketing.analyticsTab.subtitle')}
        </p>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-secondary">
              {totalSent.toLocaleString()}
            </div>
            <Send className="h-8 w-8 text-secondary/20" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.analyticsTab.totalSent')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-green-600">
              {totalDelivered.toLocaleString()}
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-200 dark:text-green-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.analyticsTab.delivered')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-blue-600">
              {totalOpened.toLocaleString()}
            </div>
            <Eye className="h-8 w-8 text-blue-200 dark:text-blue-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.analyticsTab.uniqueOpens')}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-3xl font-bold text-purple-600">
              {totalClicked.toLocaleString()}
            </div>
            <MousePointer2 className="h-8 w-8 text-purple-200 dark:text-purple-900/40" />
          </div>
          <div className="text-on-surface-variant">
            {t('emailMarketing.analyticsTab.totalClicks')}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-green-600">
                {openRate}%
              </div>
              <div className="text-on-surface-variant">{t('emailMarketing.analyticsTab.openRate')}</div>
            </div>
            <TrendingUp className="h-8 w-8 text-green-200 dark:text-green-900/40" />
          </div>
          <div className="text-sm text-on-surface-variant">
            {t('emailMarketing.analyticsTab.opensFromSent', { opens: totalOpened.toLocaleString(), sent: totalSent.toLocaleString() })}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-blue-600">
                {clickRate}%
              </div>
              <div className="text-on-surface-variant">{t('emailMarketing.analyticsTab.clickRate')}</div>
            </div>
            <MousePointer2 className="h-8 w-8 text-blue-200 dark:text-blue-900/40" />
          </div>
          <div className="text-sm text-on-surface-variant">
            {t('emailMarketing.analyticsTab.clicksFromOpens', { clicks: totalClicked.toLocaleString(), opens: totalOpened.toLocaleString() })}
          </div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-3xl font-bold text-red-600">
                {bounceRate}%
              </div>
              <div className="text-on-surface-variant">{t('emailMarketing.analyticsTab.bounceRate')}</div>
            </div>
            <TrendingDown className="h-8 w-8 text-red-200 dark:text-red-900/40" />
          </div>
          <div className="text-sm text-on-surface-variant">
            {t('emailMarketing.analyticsTab.bouncesFromSent', { bounces: totalBounced.toLocaleString(), sent: totalSent.toLocaleString() })}
          </div>
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-surface-container-low rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold text-on-surface mb-4">
          {t('emailMarketing.analyticsTab.chartHeading')}
        </h3>
        <div className="h-64 bg-surface-container-high rounded flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 text-on-surface-variant mx-auto mb-4" />
            <span className="text-on-surface-variant">
              {t('emailMarketing.analyticsTab.chartPlaceholder')}
            </span>
          </div>
        </div>
      </div>

      {/* Top Performing Campaigns */}
      <div className="bg-surface-container-low rounded-lg shadow">
        <div className="p-6 border-b border-outline-variant/20">
          <h3 className="text-lg font-semibold text-on-surface">
            {t('emailMarketing.analyticsTab.topCampaigns')}
          </h3>
        </div>
        {sortedCampaigns.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            {t('emailMarketing.analyticsTab.noCampaigns')}
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {sortedCampaigns.map((campaign: EmailCampaign, index: number) => {
              const rate = campaign.sentCount > 0 ? ((campaign.openedCount / campaign.sentCount) * 100).toFixed(1) : '0.0'
              return (
                <div key={campaign.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          index === 1 ? 'bg-gray-200 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300' :
                          index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400'
                        }`}>
                          #{index + 1}
                        </span>
                        <div>
                          <h4 className="font-semibold text-on-surface">
                            {campaign.name}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-on-surface-variant mt-1">
                            <span>{t('emailMarketing.analyticsTab.openRateValue', { rate })}</span>
                            <span>•</span>
                            <span>{t('emailMarketing.analyticsTab.sentCount', { count: campaign.sentCount.toLocaleString() })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-green-600 font-semibold">
                      {rate}%
                    </div>
                  </div>
                </div>
              )
            })}
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
      <div className="flex items-center gap-1.5 text-sm text-green-700 mt-1">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        {t('emailMarketing.providersTab.trackingOn')}
      </div>
    )
  }

  const canRetry = status === 'error' || !status
  const message = provider.webhookError || t('emailMarketing.providersTab.trackingNotSetUp')

  return (
    <div className={`flex items-start gap-1.5 text-sm mt-1 ${status === 'error' || !status ? 'text-amber-700' : 'text-on-surface-variant'}`}>
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

function ProvidersContent({ providers, loading, onEdit, onCreate, onTest, onDelete, onRetryTracking }: any) {
  const { t, formatNumber } = useI18n()
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.providersTab.heading')}
        </h2>
        <p className="text-on-surface-variant">
          {t('emailMarketing.providersTab.subtitle')}
        </p>
      </div>

      {/* Provider List */}
      <div className="space-y-4">
        {providers.map((provider: EmailProvider) => (
          <div key={provider.id} className="bg-surface-container-low rounded-lg shadow p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-lg font-semibold text-on-surface">
                    {provider.name}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded capitalize flex items-center gap-1.5 ${
                      provider.type === 'sendgrid' ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
                      provider.type === 'ses' ? 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' :
                      provider.type === 'resend' ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' :
                      provider.type === 'mailgun' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' :
                      provider.type === 'postmark' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' :
                      provider.type === 'brevo' ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
                      'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {provider.type === 'sendgrid' && <img src="https://www.vectorlogo.zone/logos/sendgrid/sendgrid-icon.svg" className="w-3.5 h-3.5" alt="" />}
                      {provider.type === 'ses' && <img src="https://www.vectorlogo.zone/logos/amazon_aws/amazon_aws-icon.svg" className="w-3.5 h-3.5" alt="" />}
                      {provider.type === 'resend' && <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/resend.svg" className="w-3.5 h-3.5 dark:invert" alt="" />}
                      {provider.type === 'mailgun' && <img src="https://www.vectorlogo.zone/logos/mailgun/mailgun-icon.svg" className="w-3.5 h-3.5" alt="" />}
                      {provider.type === 'postmark' && <img src="https://www.vectorlogo.zone/logos/postmarkapp/postmarkapp-icon.svg" className="w-3.5 h-3.5" alt="" />}
                      {provider.type === 'brevo' && <img src="https://cdn.simpleicons.org/brevo/008060" className="w-3.5 h-3.5" alt="" />}
                      {provider.type === 'custom' && <Server className="w-3.5 h-3.5" />}
                      <span className="capitalize">{provider.type}</span>
                    </span>
                    {provider.isDefault && (
                      <span className="px-2 py-1 text-xs font-medium bg-secondary/15 text-secondary rounded">
                        {t('emailMarketing.providersTab.default')}
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    provider.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {provider.isActive ? t('emailMarketing.providersTab.active') : t('emailMarketing.providersTab.inactive')}
                  </span>
                </div>
                <div className="text-on-surface-variant text-sm">
                  {t('emailMarketing.providersTab.from', { email: provider.fromEmail })}
                </div>
                <TrackingStatus provider={provider} onRetry={onRetryTracking} />
                {provider.dailyLimit && (
                  <div className="text-on-surface-variant text-sm mt-1">
                    {t('emailMarketing.providersTab.dailyLimit', { count: formatNumber(provider.dailyLimit) })}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1.5 text-sm border border-outline-variant/40 rounded hover:bg-surface-container-high" onClick={() => onEdit(provider)}>
                  {t('emailMarketing.providersTab.configure')}
                </button>
                <button className="px-3 py-1.5 text-sm border border-outline-variant/40 rounded hover:bg-surface-container-high" onClick={() => onTest(provider)}>
                  {t('emailMarketing.providersTab.test')}
                </button>
                <button className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50" onClick={() => onDelete(provider.id)}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add Provider Button */}
        <div className="bg-surface-container-low rounded-lg shadow p-6 border-2 border-dashed border-outline-variant flex flex-col items-center justify-center hover:border-secondary hover:bg-secondary/10 transition-colors cursor-pointer" onClick={onCreate}>
          <Settings className="h-12 w-12 text-on-surface-variant mb-3" />
          <button className="px-6 py-3 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors">
            {t('emailMarketing.providersTab.addNew')}
          </button>
        </div>
      </div>
    </div>
  )
}

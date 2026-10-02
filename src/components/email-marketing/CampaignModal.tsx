/**
 * Campaign Modal Component
 * 
 * Modal for creating and editing email campaigns
 */

'use client'

import { useState, useEffect } from 'react'
import { aiComplete, aiErrorMessage, parseAiJson } from '@/lib/ai/client'
import { useI18n } from '@/i18n/I18nProvider'
import { X, Send, Calendar, Users, FileText, Target, Tag, Plus, Trash2, Loader2, Mail, Code, Eye } from 'lucide-react'

// <input type="datetime-local"> wants local time; toISOString() would shift it by the UTC offset
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Older rows were stored double-encoded ("\"[]\""), so unwrap until we get a value of the right shape
function parseJson<T>(raw: unknown, fallback: T): T {
  let v: unknown = raw
  for (let i = 0; i < 3 && typeof v === 'string'; i++) {
    try { v = JSON.parse(v) } catch { return fallback }
  }
  if (Array.isArray(fallback)) return (Array.isArray(v) ? v : fallback) as T
  return (v && typeof v === 'object' && !Array.isArray(v) ? v : fallback) as T
}

interface CampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (campaign: any) => void
  campaign?: any
  workspaceId: string
  templates: any[]
  segments: any[]
}

export default function CampaignModal({
  isOpen,
  onClose,
  onSave,
  campaign,
  workspaceId,
  templates,
  segments
}: CampaignModalProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'broadcast',
    subject: '',
    fromName: '',
    fromEmail: '',
    replyTo: '',
    templateId: '',
    segmentationRuleId: '',
    scheduledAt: '',
    tags: [] as string[],
    metadata: {}
  })

  const [newTag, setNewTag] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // AI state
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([])
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false)
  const [isLoadingCopy, setIsLoadingCopy] = useState(false)
  const [campaignCopy, setCampaignCopy] = useState('')
  const [showCopyPanel, setShowCopyPanel] = useState(false)

  // Email template generator state
  const [showTemplateGenerator, setShowTemplateGenerator] = useState(false)
  const [selectedTemplateType, setSelectedTemplateType] = useState('promotional')
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false)
  const [generatedTemplate, setGeneratedTemplate] = useState('')
  const [templatePreviewMode, setTemplatePreviewMode] = useState<'html' | 'preview'>('preview')

  const generateSubjectLines = async () => {
    setIsLoadingSubjects(true)
    setSubjectSuggestions([])
    const context = [
      formData.name && `Campaign: ${formData.name}`,
      formData.description && `Description: ${formData.description}`,
      formData.type && `Type: ${formData.type}`,
    ].filter(Boolean).join('\n')
    try {
      const raw = await aiComplete({ workspaceId }, {
        prompt: `Generate 5 compelling email subject lines for this campaign:\n\n${context || 'General marketing email'}\n\nReturn a JSON object of this shape: {"subjects":["Subject 1","Subject 2","Subject 3","Subject 4","Subject 5"]}`,
        json: true,
      })
      const { subjects } = parseAiJson<{ subjects?: unknown[] }>(raw)
      setSubjectSuggestions((subjects ?? []).filter((s): s is string => typeof s === 'string').slice(0, 5))
    } catch {
      // The button stays available for a retry; out-of-credits shows its own modal.
    } finally {
      setIsLoadingSubjects(false)
    }
  }

  const generateCampaignCopy = async () => {
    setShowCopyPanel(true)
    setCampaignCopy('')
    setIsLoadingCopy(true)
    const context = [
      formData.name && `Campaign name: ${formData.name}`,
      formData.description && `Goal: ${formData.description}`,
      formData.type && `Type: ${formData.type}`,
      formData.subject && `Subject: ${formData.subject}`,
    ].filter(Boolean).join('\n')
    try {
      let text = ''
      await aiComplete({ workspaceId }, {
        prompt: `Write a concise, engaging email body for this campaign:\n\n${context || 'General marketing email'}\n\nReturn only the email body text (no subject line, no HTML tags).`,
      }, (chunk) => {
        text += chunk
        setCampaignCopy(text)
      })
    } catch (error) {
      setCampaignCopy(aiErrorMessage(error, t('emailMarketing.campaignModal.aiErrorFallback')))
    } finally {
      setIsLoadingCopy(false)
    }
  }

  const generateEmailTemplate = async () => {
    setIsGeneratingTemplate(true)
    setGeneratedTemplate('')
    try {
      const res = await fetch('/api/ai/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          templateType: selectedTemplateType,
          campaignContext: {
            name: formData.name,
            description: formData.description,
            subject: formData.subject,
            fromName: formData.fromName,
          },
        }),
      })
      if (!res.ok || !res.body) throw new Error('failed')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let html = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        setGeneratedTemplate(html)
      }
    } catch {
      setGeneratedTemplate(`<p style="color:red">${t('emailMarketing.campaignModal.aiErrorFallback')}</p>`)
    } finally {
      setIsGeneratingTemplate(false)
    }
  }

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        type: campaign.type || 'broadcast',
        subject: campaign.subject || '',
        fromName: campaign.fromName || '',
        fromEmail: campaign.fromEmail || '',
        replyTo: campaign.replyTo || '',
        templateId: campaign.templateId || '',
        segmentationRuleId: campaign.segmentationRuleId || '',
        scheduledAt: campaign.scheduledAt ? toLocalInputValue(new Date(campaign.scheduledAt)) : '',
        tags: parseJson(campaign.tags, [] as string[]),
        metadata: parseJson(campaign.metadata, {} as Record<string, any>)
      })
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'broadcast',
        subject: '',
        fromName: '',
        fromEmail: '',
        replyTo: '',
        templateId: '',
        segmentationRuleId: '',
        scheduledAt: '',
        tags: [],
        metadata: {}
      })
      setErrors({})
    }
  }, [campaign])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = t('emailMarketing.campaignModal.nameRequired')
    }
    if (!formData.subject.trim()) {
      newErrors.subject = t('emailMarketing.campaignModal.subjectRequired')
    }
    if (formData.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.fromEmail)) {
      newErrors.fromEmail = t('emailMarketing.campaignModal.invalidEmail')
    }
    if (formData.replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.replyTo)) {
      newErrors.replyTo = t('emailMarketing.campaignModal.invalidEmail')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSaving(true)

    try {
      const campaignData = {
        ...formData,
        workspaceId,
        // The API serializes these itself; sending strings stored them double-encoded
        tags: formData.tags,
        metadata: formData.metadata,
        // Convert the local time picked in the browser to an absolute instant;
        // the server would otherwise read it in its own (UTC) timezone.
        scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null
      }

      await onSave(campaignData)
      onClose()
    } catch (error) {
      console.error('Error saving campaign:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-container-low border-b border-outline-variant/20 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Send className="h-6 w-6 text-secondary" />
            <h2 className="text-xl font-semibold text-on-surface">
              {campaign ? t('emailMarketing.campaignModal.editTitle') : t('emailMarketing.campaignModal.createTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.campaignModal.basicInformation')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.campaignName')}
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.campaignModal.campaignNamePlaceholder')}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.description')}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.campaignModal.descriptionPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.campaignType')}
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                >
                  <option value="broadcast">{t('emailMarketing.campaignModal.typeBroadcast')}</option>
                  <option value="drip">{t('emailMarketing.campaignModal.typeDrip')}</option>
                  <option value="triggered">{t('emailMarketing.campaignModal.typeTriggered')}</option>
                  <option value="behavioral">{t('emailMarketing.campaignModal.typeBehavioral')}</option>
                  <option value="transactional">{t('emailMarketing.campaignModal.typeTransactional')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.schedule')}
                </label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-on-surface-variant">{t('emailMarketing.campaignModal.scheduleHint')}</p>
              </div>
            </div>
          </div>

          {/* Email Content */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Send className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.campaignModal.emailContent')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.subjectLine')}
                </label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                        errors.subject ? 'border-red-500' : 'border-outline-variant/40'
                      }`}
                      placeholder={t('emailMarketing.campaignModal.subjectPlaceholder')}
                    />
                    {errors.subject && (
                      <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={generateSubjectLines}
                    disabled={isLoadingSubjects}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/15 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {isLoadingSubjects ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-base leading-none">✨</span>}
                    {t('emailMarketing.campaignModal.suggest')}
                  </button>
                </div>
                {/* AI Subject Suggestions */}
                {subjectSuggestions.length > 0 && (
                  <div className="mt-2 border border-secondary/20 rounded-lg bg-secondary/15 p-3 space-y-1">
                    <p className="text-xs font-semibold text-secondary mb-2">{t('emailMarketing.campaignModal.aiSuggestionsLabel')}</p>
                    {subjectSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, subject: s }))
                          setSubjectSuggestions([])
                        }}
                        className="w-full text-left text-sm text-on-surface-variant hover:text-secondary hover:bg-secondary/15 rounded px-2 py-1 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Campaign Copy */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-on-surface">{t('emailMarketing.campaignModal.campaignCopy')}</label>
                  <button
                    type="button"
                    onClick={generateCampaignCopy}
                    disabled={isLoadingCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/15 transition-colors disabled:opacity-50"
                  >
                    {isLoadingCopy ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>✨</span>}
                    {t('emailMarketing.campaignModal.writeWithAI')}
                  </button>
                </div>
                {showCopyPanel && (
                  <div className="border border-secondary/30 rounded-lg bg-surface-container-low">
                    <div className="min-h-[120px] p-3 text-sm text-on-surface-variant whitespace-pre-wrap">
                      {isLoadingCopy && !campaignCopy
                        ? <div className="flex items-center gap-2 text-on-surface-variant"><Loader2 className="h-4 w-4 animate-spin" /> {t('emailMarketing.campaignModal.writing')}</div>
                        : campaignCopy || '…'
                      }
                    </div>
                    {!isLoadingCopy && campaignCopy && (
                      <div className="border-t border-secondary/20 px-3 py-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(campaignCopy)}
                          className="text-xs text-secondary hover:underline"
                        >
                          {t('emailMarketing.campaignModal.copyToClipboard')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowCopyPanel(false); setCampaignCopy('') }}
                          className="text-xs text-on-surface-variant hover:text-on-surface"
                        >
                          {t('emailMarketing.campaignModal.dismiss')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* AI Email Template Generator */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-on-surface flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-secondary" />
                    {t('emailMarketing.campaignModal.htmlEmailTemplate')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTemplateGenerator(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-secondary border border-secondary/30 rounded-lg hover:bg-secondary/15 transition-colors"
                  >
                    <span>✨</span>
                    {showTemplateGenerator ? t('emailMarketing.campaignModal.hideGenerator') : t('emailMarketing.campaignModal.generateWithAI')}
                  </button>
                </div>

                {showTemplateGenerator && (
                  <div className="border border-secondary/30 rounded-lg overflow-hidden">
                    {/* Template type picker */}
                    <div className="bg-secondary/15 px-4 py-3 border-b border-secondary/20">
                      <p className="text-xs font-semibold text-secondary mb-2">{t('emailMarketing.campaignModal.chooseTemplateType')}</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'welcome', label: t('emailMarketing.campaignModal.templateWelcome') },
                          { value: 'promotional', label: t('emailMarketing.campaignModal.templatePromotional') },
                          { value: 'newsletter', label: t('emailMarketing.campaignModal.templateNewsletter') },
                          { value: 'announcement', label: t('emailMarketing.campaignModal.templateAnnouncement') },
                          { value: 'followup', label: t('emailMarketing.campaignModal.templateFollowup') },
                          { value: 'transactional', label: t('emailMarketing.campaignModal.templateTransactional') },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSelectedTemplateType(opt.value)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              selectedTemplateType === opt.value
                                ? 'bg-secondary text-on-secondary border-secondary'
                                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:border-secondary/50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={generateEmailTemplate}
                        disabled={isGeneratingTemplate}
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary text-xs font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                      >
                        {isGeneratingTemplate ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('emailMarketing.campaignModal.generating')}</>
                        ) : (
                          <><span>✨</span> {t('emailMarketing.campaignModal.generateTemplate')}</>
                        )}
                      </button>
                    </div>

                    {/* Template output */}
                    {(generatedTemplate || isGeneratingTemplate) && (
                      <div>
                        {/* Preview / HTML toggle */}
                        <div className="flex items-center gap-1 px-4 py-2 border-b border-outline-variant/10 bg-surface-container-low">
                          <button
                            type="button"
                            onClick={() => setTemplatePreviewMode('preview')}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                              templatePreviewMode === 'preview'
                                ? 'bg-secondary/15 text-secondary font-medium'
                                : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            <Eye className="h-3 w-3" /> {t('emailMarketing.campaignModal.preview')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTemplatePreviewMode('html')}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                              templatePreviewMode === 'html'
                                ? 'bg-secondary/15 text-secondary font-medium'
                                : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            <Code className="h-3 w-3" /> {t('emailMarketing.campaignModal.html')}
                          </button>
                        </div>

                        {templatePreviewMode === 'preview' ? (
                          <div className="bg-surface-container-high p-2">
                            {isGeneratingTemplate && !generatedTemplate ? (
                              <div className="flex items-center gap-2 text-on-surface-variant text-sm p-4">
                                <Loader2 className="h-4 w-4 animate-spin" /> {t('emailMarketing.campaignModal.generatingTemplate')}
                              </div>
                            ) : (
                              <iframe
                                srcDoc={generatedTemplate}
                                className="w-full rounded border border-outline-variant/20 bg-surface-container-lowest"
                                style={{ height: '400px' }}
                                sandbox="allow-same-origin"
                                title={t('misc.emailPreview')}
                              />
                            )}
                          </div>
                        ) : (
                          <textarea
                            readOnly
                            value={generatedTemplate}
                            className="w-full h-64 p-3 text-xs font-mono text-on-surface-variant bg-gray-900 text-green-400 resize-none focus:outline-none"
                          />
                        )}

                        {!isGeneratingTemplate && generatedTemplate && (
                          <div className="flex gap-3 px-4 py-2 border-t border-outline-variant/10 bg-surface-container-low">
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(generatedTemplate)}
                              className="text-xs text-secondary hover:underline"
                            >
                              {t('emailMarketing.campaignModal.copyHtml')}
                            </button>
                            <button
                              type="button"
                              onClick={generateEmailTemplate}
                              className="text-xs text-on-surface-variant hover:text-on-surface"
                            >
                              {t('emailMarketing.campaignModal.regenerate')}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setGeneratedTemplate(''); setShowTemplateGenerator(false) }}
                              className="text-xs text-on-surface-variant hover:text-on-surface ml-auto"
                            >
                              {t('emailMarketing.campaignModal.dismiss')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.template')}
                </label>
                <select
                  name="templateId"
                  value={formData.templateId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                >
                  <option value="">{t('emailMarketing.campaignModal.selectTemplate')}</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.segment')}
                </label>
                <select
                  name="segmentationRuleId"
                  value={formData.segmentationRuleId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                >
                  <option value="">{t('emailMarketing.campaignModal.allRecipients')}</option>
                  {segments.map(segment => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sender Information */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.campaignModal.senderInformation')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.fromName')}
                </label>
                <input
                  type="text"
                  name="fromName"
                  value={formData.fromName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.campaignModal.fromNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.fromEmail')}
                </label>
                <input
                  type="email"
                  name="fromEmail"
                  value={formData.fromEmail}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.fromEmail ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.campaignModal.fromEmailPlaceholder')}
                />
                {errors.fromEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.fromEmail}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.campaignModal.replyTo')}
                </label>
                <input
                  type="email"
                  name="replyTo"
                  value={formData.replyTo}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.replyTo ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.campaignModal.replyToPlaceholder')}
                />
                {errors.replyTo && (
                  <p className="mt-1 text-sm text-red-600">{errors.replyTo}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Tag className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.campaignModal.tags')}
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.campaignModal.addTagPlaceholder')}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('common.add')}</span>
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-secondary/15 text-secondary rounded-full text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-secondary"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-outline-variant/40 rounded-lg hover:bg-surface-container-high transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>{campaign ? t('emailMarketing.campaignModal.updateCampaign') : t('emailMarketing.campaignModal.createCampaignButton')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Campaign Modal Component
 * 
 * Modal for creating and editing email campaigns
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Send, Calendar, Users, FileText, Target, Tag, Plus, Trash2, Loader2, Mail, Code, Eye } from 'lucide-react'

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
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Generate 5 compelling email subject lines for this campaign:\n\n${context || 'General marketing email'}\n\nReturn ONLY a JSON array of 5 strings. Example: ["Subject 1","Subject 2","Subject 3","Subject 4","Subject 5"]`
          }]
        }),
      })
      if (!res.ok || !res.body) throw new Error('failed')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let raw = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        raw += decoder.decode(value)
      }
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) setSubjectSuggestions(JSON.parse(match[0]))
    } catch {
      // silently fail
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
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Write a concise, engaging email body for this campaign:\n\n${context || 'General marketing email'}\n\nReturn only the email body text (no subject line, no HTML tags).`
          }]
        }),
      })
      if (!res.ok || !res.body) throw new Error('failed')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value)
        setCampaignCopy(text)
      }
    } catch {
      setCampaignCopy('Something went wrong. Please try again.')
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
        html += decoder.decode(value)
        setGeneratedTemplate(html)
      }
    } catch {
      setGeneratedTemplate('<p style="color:red">Something went wrong. Please try again.</p>')
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
        scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString().slice(0, 16) : '',
        tags: campaign.tags ? JSON.parse(campaign.tags) : [],
        metadata: campaign.metadata ? JSON.parse(campaign.metadata) : {}
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
      newErrors.name = 'Campaign name is required'
    }
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject line is required'
    }
    if (formData.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.fromEmail)) {
      newErrors.fromEmail = 'Invalid email address'
    }
    if (formData.replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.replyTo)) {
      newErrors.replyTo = 'Invalid email address'
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
        tags: JSON.stringify(formData.tags),
        metadata: JSON.stringify(formData.metadata)
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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Send className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {campaign ? 'Edit Campaign' : 'Create New Campaign'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-indigo-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Welcome Email Campaign"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Describe the purpose of this campaign..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Type
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="broadcast">Broadcast</option>
                  <option value="drip">Drip Campaign</option>
                  <option value="triggered">Triggered</option>
                  <option value="behavioral">Behavioral</option>
                  <option value="transactional">Transactional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule
                </label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">Leave empty to send immediately</p>
              </div>
            </div>
          </div>

          {/* Email Content */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Send className="h-5 w-5 mr-2 text-indigo-600" />
              Email Content
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Line *
                </label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        errors.subject ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., Welcome to our platform!"
                    />
                    {errors.subject && (
                      <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={generateSubjectLines}
                    disabled={isLoadingSubjects}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {isLoadingSubjects ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-base leading-none">✨</span>}
                    Suggest
                  </button>
                </div>
                {/* AI Subject Suggestions */}
                {subjectSuggestions.length > 0 && (
                  <div className="mt-2 border border-indigo-100 rounded-lg bg-indigo-50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-indigo-600 mb-2">AI Suggestions — click to use:</p>
                    {subjectSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, subject: s }))
                          setSubjectSuggestions([])
                        }}
                        className="w-full text-left text-sm text-gray-700 hover:text-indigo-700 hover:bg-indigo-100 rounded px-2 py-1 transition-colors"
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
                  <label className="block text-sm font-medium text-gray-700">Campaign Copy</label>
                  <button
                    type="button"
                    onClick={generateCampaignCopy}
                    disabled={isLoadingCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    {isLoadingCopy ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>✨</span>}
                    Write with AI
                  </button>
                </div>
                {showCopyPanel && (
                  <div className="border border-indigo-200 rounded-lg bg-white">
                    <div className="min-h-[120px] p-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {isLoadingCopy && !campaignCopy
                        ? <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Writing…</div>
                        : campaignCopy || '…'
                      }
                    </div>
                    {!isLoadingCopy && campaignCopy && (
                      <div className="border-t border-indigo-100 px-3 py-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(campaignCopy)}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Copy to clipboard
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowCopyPanel(false); setCampaignCopy('') }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* AI Email Template Generator */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-indigo-500" />
                    HTML Email Template
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTemplateGenerator(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <span>✨</span>
                    {showTemplateGenerator ? 'Hide Generator' : 'Generate with AI'}
                  </button>
                </div>

                {showTemplateGenerator && (
                  <div className="border border-indigo-200 rounded-lg overflow-hidden">
                    {/* Template type picker */}
                    <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                      <p className="text-xs font-semibold text-indigo-700 mb-2">Choose template type:</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'welcome', label: 'Welcome' },
                          { value: 'promotional', label: 'Promotional' },
                          { value: 'newsletter', label: 'Newsletter' },
                          { value: 'announcement', label: 'Announcement' },
                          { value: 'followup', label: 'Follow-up' },
                          { value: 'transactional', label: 'Transactional' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSelectedTemplateType(opt.value)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              selectedTemplateType === opt.value
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
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
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {isGeneratingTemplate ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                        ) : (
                          <><span>✨</span> Generate Template</>
                        )}
                      </button>
                    </div>

                    {/* Template output */}
                    {(generatedTemplate || isGeneratingTemplate) && (
                      <div>
                        {/* Preview / HTML toggle */}
                        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-white">
                          <button
                            type="button"
                            onClick={() => setTemplatePreviewMode('preview')}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                              templatePreviewMode === 'preview'
                                ? 'bg-indigo-100 text-indigo-700 font-medium'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <Eye className="h-3 w-3" /> Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => setTemplatePreviewMode('html')}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                              templatePreviewMode === 'html'
                                ? 'bg-indigo-100 text-indigo-700 font-medium'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <Code className="h-3 w-3" /> HTML
                          </button>
                        </div>

                        {templatePreviewMode === 'preview' ? (
                          <div className="bg-gray-50 p-2">
                            {isGeneratingTemplate && !generatedTemplate ? (
                              <div className="flex items-center gap-2 text-gray-400 text-sm p-4">
                                <Loader2 className="h-4 w-4 animate-spin" /> Generating template…
                              </div>
                            ) : (
                              <iframe
                                srcDoc={generatedTemplate}
                                className="w-full rounded border border-gray-200 bg-white"
                                style={{ height: '400px' }}
                                sandbox="allow-same-origin"
                                title="Email preview"
                              />
                            )}
                          </div>
                        ) : (
                          <textarea
                            readOnly
                            value={generatedTemplate}
                            className="w-full h-64 p-3 text-xs font-mono text-gray-700 bg-gray-900 text-green-400 resize-none focus:outline-none"
                          />
                        )}

                        {!isGeneratingTemplate && generatedTemplate && (
                          <div className="flex gap-3 px-4 py-2 border-t border-gray-100 bg-white">
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(generatedTemplate)}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              Copy HTML
                            </button>
                            <button
                              type="button"
                              onClick={generateEmailTemplate}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Regenerate
                            </button>
                            <button
                              type="button"
                              onClick={() => { setGeneratedTemplate(''); setShowTemplateGenerator(false) }}
                              className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template
                </label>
                <select
                  name="templateId"
                  value={formData.templateId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select a template</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Segment
                </label>
                <select
                  name="segmentationRuleId"
                  value={formData.segmentationRuleId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All recipients</option>
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
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-indigo-600" />
              Sender Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Name
                </label>
                <input
                  type="text"
                  name="fromName"
                  value={formData.fromName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Your Company Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Email
                </label>
                <input
                  type="email"
                  name="fromEmail"
                  value={formData.fromEmail}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.fromEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., noreply@yourcompany.com"
                />
                {errors.fromEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.fromEmail}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reply To
                </label>
                <input
                  type="email"
                  name="replyTo"
                  value={formData.replyTo}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.replyTo ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., support@yourcompany.com"
                />
                {errors.replyTo && (
                  <p className="mt-1 text-sm text-red-600">{errors.replyTo}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Tag className="h-5 w-5 mr-2 text-indigo-600" />
              Tags
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Add a tag..."
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add</span>
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-indigo-600"
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
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>{campaign ? 'Update Campaign' : 'Create Campaign'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

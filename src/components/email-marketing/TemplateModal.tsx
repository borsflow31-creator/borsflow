'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import {
  X, FileText, Code, Tag, Plus,
  ChevronDown, ChevronUp, Save, Wand2, Layout, Eye
} from 'lucide-react'
import EmailBlockEditor, { blocksToHtml, htmlToBlocks } from './EmailBlockEditor'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (template: any) => void
  template?: any
  workspaceId: string
}

type EditorTab = 'design' | 'html' | 'preview'

export default function TemplateModal({ isOpen, onClose, onSave, template, workspaceId }: TemplateModalProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    name: '', description: '', type: 'marketing', subject: '',
    htmlContent: '', textContent: '', variables: [] as string[], tags: [] as string[]
  })
  const [newVariable, setNewVariable] = useState('')
  const [newTag, setNewTag]           = useState('')
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [activeTab, setActiveTab]     = useState<EditorTab>('design')
  const [openSections, setOpenSections] = useState({ meta: true, variables: false, tags: false, plaintext: false })

  // Track the htmlContent that was last pushed INTO the block editor
  // so we know when to re-initialize it (template change) vs when the editor
  // is updating us (onChange callback).
  const editorInitHtml = useRef<string>('')

  // ── populate form when template/isOpen changes ──────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const html = template?.htmlContent || ''
    setFormData({
      name:        template?.name        || '',
      description: template?.description || '',
      type:        template?.type        || 'marketing',
      subject:     template?.subject     || '',
      htmlContent: html,
      textContent: template?.textContent || '',
      variables: template?.variables
        ? (Array.isArray(template.variables) ? template.variables : JSON.parse(template.variables))
        : [],
      tags: template?.tags
        ? (Array.isArray(template.tags) ? template.tags : JSON.parse(template.tags))
        : [],
    })
    editorInitHtml.current = html
    setActiveTab('design')
    setErrors({})
    setSaveError(null)
  }, [template, isOpen])

  const set = (key: string, value: any) => {
    setFormData(p => ({ ...p, [key]: value }))
    setErrors(p => { const n = { ...p }; delete n[key]; return n })
  }

  const toggleSection = (s: keyof typeof openSections) =>
    setOpenSections(p => ({ ...p, [s]: !p[s] }))

  const addVariable = () => {
    const v = newVariable.trim()
    if (v && !formData.variables.includes(v)) { set('variables', [...formData.variables, v]); setNewVariable('') }
  }
  const addTag = () => {
    const t = newTag.trim()
    if (t && !formData.tags.includes(t)) { set('tags', [...formData.tags, t]); setNewTag('') }
  }

  // Called by EmailBlockEditor whenever blocks change → keep formData in sync
  const handleDesignChange = useCallback((html: string) => {
    setFormData(prev => ({ ...prev, htmlContent: html }))
  }, [])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!formData.name.trim())    e.name    = t('common.required')
    if (!formData.subject.trim()) e.subject = t('common.required')
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (ev: React.MouseEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSaving(true); setSaveError(null)
    try {
      await onSave({ ...formData, workspaceId })
      onClose()
    } catch (err: any) {
      setSaveError(err?.message || t('emailMarketing.templateModal.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const Section = ({ id, label, icon: Icon, children }: { id: keyof typeof openSections; label: string; icon: any; children: React.ReactNode }) => (
    <div className="border-b border-outline-variant/20 last:border-0">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition"
      >
        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{label}</span>
        {openSections[id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {openSections[id] && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/50 ${err ? 'border-red-400' : 'border-outline-variant/40'}`

  const tabs: { id: EditorTab; label: string; icon: React.ElementType }[] = [
    { id: 'design',  label: t('emailMarketing.templateModal.tabDesign'),  icon: Layout },
    { id: 'html',    label: t('emailMarketing.templateModal.tabHtml'),    icon: Code },
    { id: 'preview', label: t('emailMarketing.templateModal.tabPreview'), icon: Eye },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">

      {/* ══ Top bar ══ */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-outline-variant/20 bg-surface-container-low px-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <Wand2 className="h-4 w-4 text-on-secondary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-on-surface leading-tight">
              {formData.name || (template ? t('emailMarketing.templateModal.editTitle') : t('emailMarketing.templateModal.newTitle'))}
            </div>
            {formData.subject && (
              <div className="text-xs text-on-surface-variant leading-tight truncate max-w-xs">{formData.subject}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Design / HTML / Preview tabs */}
          <div className="flex items-center rounded-lg border border-outline-variant/20 overflow-hidden text-xs font-medium">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition ${i > 0 ? 'border-l border-outline-variant/20' : ''} ${
                  activeTab === tab.id
                    ? tab.id === 'html' ? 'bg-on-surface text-background' : 'bg-secondary text-on-secondary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {saveError && (
            <span className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-700 max-w-xs truncate">{saveError}</span>
          )}

          <button type="button" onClick={onClose}
            className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition">
            {t('emailMarketing.templateModal.discard')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-1.5 text-xs font-semibold text-on-secondary hover:opacity-90 transition disabled:opacity-50"
          >
            {saving
              ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-secondary/30 border-t-on-secondary" />{t('common.saving')}</>
              : <><Save className="h-3.5 w-3.5" />{template ? t('emailMarketing.templateModal.saveChanges') : t('emailMarketing.templateModal.createTemplate')}</>
            }
          </button>
          <button type="button" onClick={onClose} className="ml-1 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ══ Body ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-outline-variant/20 bg-surface-container-low flex flex-col">

          <Section id="meta" label={t('emailMarketing.templateModal.templateInfo')} icon={FileText}>
            <div>
              <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t('emailMarketing.templateModal.name')}</label>
              <input value={formData.name} onChange={e => set('name', e.target.value)}
                placeholder={t('emailMarketing.templateModal.namePlaceholder')} className={inputCls(errors.name)} />
              {errors.name && <p className="mt-0.5 text-[11px] text-red-500">{errors.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t('emailMarketing.templateModal.subjectLine')}</label>
              <input value={formData.subject} onChange={e => set('subject', e.target.value)}
                placeholder={t('emailMarketing.templateModal.subjectPlaceholder')} className={inputCls(errors.subject)} />
              {errors.subject && <p className="mt-0.5 text-[11px] text-red-500">{errors.subject}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t('emailMarketing.templateModal.type')}</label>
              <select value={formData.type} onChange={e => set('type', e.target.value)} className={inputCls()}>
                <option value="marketing">{t('emailMarketing.templateModal.typeMarketing')}</option>
                <option value="transactional">{t('emailMarketing.templateModal.typeTransactional')}</option>
                <option value="automation">{t('emailMarketing.templateModal.typeAutomation')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-on-surface-variant">{t('emailMarketing.templateModal.description')}</label>
              <textarea value={formData.description} onChange={e => set('description', e.target.value)}
                rows={2} placeholder={t('emailMarketing.templateModal.descriptionPlaceholder')} className={`${inputCls()} resize-none`} />
            </div>
          </Section>

          <Section id="variables" label={t('emailMarketing.templateModal.variables')} icon={Code}>
            <div className="flex gap-1.5">
              <input value={newVariable} onChange={e => setNewVariable(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addVariable())}
                placeholder={t('emailMarketing.templateModal.variablePlaceholder')} className={`${inputCls()} flex-1`} />
              <button type="button" onClick={addVariable}
                className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-on-secondary hover:opacity-90 transition">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {formData.variables.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.variables.map((v, i) => (
                  <div key={i} className="inline-flex items-center overflow-hidden rounded-full border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/30">
                    <span className="px-2.5 py-0.5 font-mono text-[11px] text-blue-700 dark:text-blue-300">{`{{${v}}}`}</span>
                    <button type="button" onClick={() => set('variables', formData.variables.filter(x => x !== v))}
                      className="px-1.5 py-0.5 text-blue-400 dark:text-blue-300/70 hover:bg-red-50 hover:text-red-500 transition">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {formData.variables.length === 0 && (
              <p className="text-[11px] text-on-surface-variant">{t('emailMarketing.templateModal.variablesHint', { example: 'first_name' })}</p>
            )}
          </Section>

          <Section id="tags" label={t('emailMarketing.templateModal.tags')} icon={Tag}>
            <div className="flex gap-1.5">
              <input value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder={t('emailMarketing.templateModal.tagPlaceholder')} className={`${inputCls()} flex-1`} />
              <button type="button" onClick={addTag}
                className="flex items-center rounded-lg bg-secondary px-2.5 py-1.5 text-on-secondary hover:opacity-90 transition">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary/15 px-2.5 py-0.5 text-[11px] text-secondary">
                    {tag}
                    <button type="button" onClick={() => set('tags', formData.tags.filter(x => x !== tag))}
                      className="hover:text-red-500 transition"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section id="plaintext" label={t('emailMarketing.templateModal.plainText')} icon={FileText}>
            <p className="text-[11px] text-on-surface-variant mb-1">{t('emailMarketing.templateModal.plainTextHint')}</p>
            <textarea value={formData.textContent} onChange={e => set('textContent', e.target.value)}
              rows={5} placeholder={t('emailMarketing.templateModal.plainTextPlaceholder')}
              className={`${inputCls()} font-mono text-[11px] resize-none`} />
          </Section>

          {(errors.name || errors.subject) && (
            <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {t('emailMarketing.templateModal.requiredFieldsNotice')}
            </div>
          )}
        </aside>

        {/* ── Editor area ── */}
        <main className="flex-1 overflow-hidden flex flex-col bg-background">

          {/* Design tab — full EmailBlockEditor */}
          {activeTab === 'design' && (
            <div className="flex-1 overflow-hidden">
              <EmailBlockEditor
                key={editorInitHtml.current}
                initialHtml={editorInitHtml.current}
                variables={formData.variables}
                onChange={handleDesignChange}
                fullHeight
              />
            </div>
          )}

          {/* HTML tab — raw textarea */}
          {activeTab === 'html' && (
            <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
              {formData.variables.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2">
                  <span className="text-xs text-on-surface-variant mr-1">{t('emailMarketing.templateModal.htmlVariablesLabel')}</span>
                  {formData.variables.map((v, i) => (
                    <span key={i} className="rounded-full border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/30 px-2 py-0.5 font-mono text-[11px] text-blue-700 dark:text-blue-300">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
              <textarea
                value={formData.htmlContent}
                onChange={e => {
                  set('htmlContent', e.target.value)
                  // Keep the block editor in sync so switching back to Design re-parses
                  editorInitHtml.current = e.target.value
                }}
                className="flex-1 min-h-[500px] rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-mono text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-none shadow-sm"
                placeholder={t('emailMarketing.templateModal.htmlPlaceholder')}
              />
            </div>
          )}

          {/* Preview tab — read-only iframe */}
          {activeTab === 'preview' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-center gap-4 border-b border-outline-variant/20 bg-surface-container-low py-2 px-4 text-xs font-medium text-on-surface-variant">
                {t('emailMarketing.templateModal.previewReadOnly')}
              </div>
              <div className="flex-1 bg-background p-4 overflow-auto flex items-start justify-center">
                {formData.htmlContent ? (
                  <iframe
                    srcDoc={formData.htmlContent}
                    sandbox="allow-same-origin"
                    title={t('misc.templatePreview')}
                    className="rounded-xl border border-stone-200 bg-white shadow-md"
                    style={{ width: 640, minHeight: 600, border: 'none' }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 text-on-surface-variant mt-20">
                    <Eye className="h-12 w-12 opacity-20" />
                    <p className="text-sm">{t('emailMarketing.templateModal.nothingToPreview')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

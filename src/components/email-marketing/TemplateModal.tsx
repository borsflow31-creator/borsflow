'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import {
  X, FileText, Code, Tag, Plus, PenLine,
  ChevronDown, ChevronUp, Save, Eye, Settings2, AlertTriangle, SendHorizontal
} from 'lucide-react'
import SimpleEmailEditor from './SimpleEmailEditor'
import { detectEditorMode, htmlToPlainText, htmlToSimpleBody, simpleToHtml } from '@/lib/email-editor-mode'
import { renderWithSamples } from '@/lib/email/tokens'

interface TemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (template: any) => void
  template?: any
  workspaceId: string
}

type EditorTab = 'design' | 'html' | 'preview'

// Defined at module scope so inputs inside keep focus across re-renders
function Section({ label, icon: Icon, open, onToggle, children }: {
  label: string; icon: React.ElementType; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border-b border-outline-variant/20 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition"
      >
        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{label}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

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
  const [openSections, setOpenSections] = useState({ meta: true, variables: true, tags: false, plaintext: false })
  const [settingsOpen, setSettingsOpen] = useState(false)
  /**
   * True when this template's HTML was built by the block designer or pasted in
   * whole, and so is not the editor's own format. There used to be an editor for
   * each of those; now there is one, and such a template is shown with the offer
   * to bring it across (which simplifies its layout) or to edit its HTML.
   */
  const [legacy, setLegacy] = useState(false)
  // Result of the last "send me a test", shown next to the button
  const [testState, setTestState] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  // Bumped to remount an editor after its content is replaced from outside
  const [editorKey, setEditorKey] = useState(0)
  // Snapshot of the form when opened, used to detect unsaved changes
  const initialSnapshot = useRef('')

  // Track the htmlContent that was last pushed INTO the block editor
  // so we know when to re-initialize it (template change) vs when the editor
  // is updating us (onChange callback).
  const editorInitHtml = useRef<string>('')

  // The plain-text part used to be derived only when it was empty, so after the
  // first save it was frozen: every later edit to the design went out with the
  // original plain text still attached, and text-only readers got a different
  // email from everyone else. These two let `handleSubmit` tell apart a
  // plain-text part the user wrote (keep it) from one we derived (re-derive it
  // whenever the HTML has moved on).
  const loadedHtml = useRef('')
  const [textHandwritten, setTextHandwritten] = useState(false)

  // ── populate form when template/isOpen changes ──────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const html = template?.htmlContent || ''
    const initial = {
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
    }
    setFormData(initial)
    initialSnapshot.current = JSON.stringify(initial)
    editorInitHtml.current = html
    loadedHtml.current = html
    setTextHandwritten(false)
    setLegacy(detectEditorMode(html) !== null && detectEditorMode(html) !== 'simple')
    setEditorKey(k => k + 1)
    setActiveTab('design')
    setErrors({})
    setSaveError(null)
    setSettingsOpen(false)
    setTestState(null)
  }, [template, isOpen])

  const isDirty = isOpen && JSON.stringify(formData) !== initialSnapshot.current

  const requestClose = useCallback(() => {
    if (isDirty && !window.confirm(t('emailMarketing.templateModal.discardConfirm'))) return
    onClose()
  }, [isDirty, onClose, t])

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

  // Called by the active editor whenever content changes → keep formData in sync
  const handleDesignChange = useCallback((html: string) => {
    setFormData(prev => ({ ...prev, htmlContent: html }))
    setErrors(prev => { const n = { ...prev }; delete n.htmlContent; return n })
  }, [])

  /**
   * Bring an old template into the editor. The conversion keeps the text, the
   * links and the lists and drops the layout the block designer built, so it is
   * confirmed first — and nothing is written until Save, so it can be abandoned
   * by closing without saving.
   */
  const importLegacy = () => {
    if (!window.confirm(t('emailMarketing.templateModal.legacyImportConfirm'))) return
    const html = simpleToHtml(htmlToSimpleBody(formData.htmlContent), { unsubscribe: true })
    editorInitHtml.current = html
    setFormData(prev => ({ ...prev, htmlContent: html }))
    setLegacy(false)
    setEditorKey(k => k + 1)
    setActiveTab('design')
  }

  /**
   * Mail the draft to the signed-in user. The body is what is on screen, not
   * what is saved, because the point is to see it in a real inbox before
   * committing to it.
   */
  const sendTest = async () => {
    if (!formData.subject.trim() || !formData.htmlContent.trim()) {
      setTestState({ ok: false, message: t('emailMarketing.templateModal.testNeedsContent') })
      return
    }
    setTesting(true)
    setTestState(null)
    try {
      const res = await fetch('/api/email-marketing/templates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          subject: formData.subject,
          htmlContent: formData.htmlContent,
          textContent: formData.textContent,
        }),
      })
      const data = await res.json().catch(() => ({}))
      setTestState(res.ok
        ? { ok: true, message: t('emailMarketing.templateModal.testSent', { email: data.to }) }
        : { ok: false, message: data.error || t('emailMarketing.templateModal.testFailed') })
    } catch {
      setTestState({ ok: false, message: t('emailMarketing.templateModal.testFailed') })
    } finally {
      setTesting(false)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!formData.name.trim())    e.name    = t('common.required')
    if (!formData.subject.trim()) e.subject = t('common.required')
    if (!formData.htmlContent.trim()) e.htmlContent = t('emailMarketing.templateModal.bodyRequired')
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async (ev?: React.MouseEvent) => {
    ev?.preventDefault()
    if (saving) return
    if (!validate()) return
    setSaving(true); setSaveError(null)
    try {
      // Every email gets a plain-text part, even if the user never wrote one,
      // and a derived one is re-derived whenever the design has changed since
      // this template was opened. A hand-written part is always kept.
      const htmlChanged = formData.htmlContent !== loadedHtml.current
      const keepText = Boolean(formData.textContent.trim()) && (textHandwritten || !htmlChanged)
      const textContent = keepText ? formData.textContent : htmlToPlainText(formData.htmlContent)
      await onSave({ ...formData, textContent, workspaceId })
      onClose()
    } catch (err: any) {
      setSaveError(err?.message || t('emailMarketing.templateModal.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // Esc closes (with unsaved-changes check), Ctrl/Cmd+S saves
  const submitRef = useRef(handleSubmit)
  submitRef.current = handleSubmit
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); submitRef.current() }
      else if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, requestClose])

  if (!isOpen) return null

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/50 ${err ? 'border-red-400' : 'border-outline-variant/40'}`

  // Raw HTML is offered only for a template the editor cannot own: for its own
  // content the tab is a way to break the markup it relies on, which is why the
  // "just write" editor never showed it.
  const tabs: { id: EditorTab; label: string; icon: React.ElementType }[] = [
    { id: 'design', label: t('emailMarketing.templateModal.tabWrite'), icon: PenLine },
    ...(legacy ? [{ id: 'html' as const, label: t('emailMarketing.templateModal.tabHtml'), icon: Code }] : []),
    { id: 'preview', label: t('emailMarketing.templateModal.tabPreview'), icon: Eye },
  ]
  // The editor has its own subject line, like Gmail's compose window
  const showTopSubject = legacy || activeTab !== 'design'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">

      {/* ══ Top bar: name + subject always visible ══ */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-outline-variant/20 bg-surface-container-low px-5 py-2.5 shadow-sm">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <div className="relative min-w-0 sm:w-56">
            <input
              value={formData.name}
              onChange={e => set('name', e.target.value)}
              placeholder={t('emailMarketing.templateModal.namePlaceholder')}
              aria-label={t('emailMarketing.templateModal.name')}
              className={`w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 ${errors.name ? 'border-red-400' : 'border-transparent hover:border-outline-variant/40'}`}
            />
            {isDirty && <span className="absolute -right-1 top-1 h-2 w-2 rounded-full bg-secondary" />}
          </div>
          {showTopSubject && (
            <input
              value={formData.subject}
              onChange={e => set('subject', e.target.value)}
              placeholder={t('emailMarketing.templateModal.subjectPlaceholder')}
              aria-label={t('emailMarketing.templateModal.subjectLine')}
              className={`min-w-0 flex-1 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 ${errors.subject ? 'border-red-400' : 'border-transparent hover:border-outline-variant/40'}`}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Write / HTML / Preview */}
          <div className="flex items-center rounded-lg border border-outline-variant/20 overflow-hidden text-xs font-medium">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition ${i > 0 ? 'border-l border-outline-variant/20' : ''} ${
                  activeTab === tab.id
                    ? 'bg-secondary text-on-secondary'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(v => !v)}
            aria-pressed={settingsOpen}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${settingsOpen ? 'border-secondary bg-secondary/15 text-secondary' : 'border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t('emailMarketing.templateModal.settings')}
          </button>

          <button
            type="button"
            onClick={sendTest}
            disabled={testing}
            title={t('emailMarketing.templateModal.testSendHint')}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high disabled:opacity-50"
          >
            {testing
              ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-surface-variant/30 border-t-on-surface-variant" />
              : <SendHorizontal className="h-3.5 w-3.5" />}
            {t('emailMarketing.templateModal.testSend')}
          </button>

          <button type="button" onClick={requestClose}
            className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition">
            {t('emailMarketing.templateModal.discard')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            title="Ctrl+S"
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-1.5 text-xs font-semibold text-on-secondary hover:opacity-90 transition disabled:opacity-50"
          >
            {saving
              ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-secondary/30 border-t-on-secondary" />{t('common.saving')}</>
              : <><Save className="h-3.5 w-3.5" />{template ? t('emailMarketing.templateModal.saveChanges') : t('emailMarketing.templateModal.createTemplate')}</>
            }
          </button>
          <button type="button" onClick={requestClose} aria-label={t('common.close')} className="ml-1 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Errors get a full-width banner instead of a truncated pill */}
      {(saveError || errors.name || errors.subject || errors.htmlContent) && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700">
          {saveError || (errors.name || errors.subject ? t('emailMarketing.templateModal.requiredFieldsNotice') : errors.htmlContent)}
        </div>
      )}

      {testState && (
        <div className={`shrink-0 border-b px-5 py-2 text-xs ${testState.ok
          ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300'
          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300'}`}>
          {testState.message}
        </div>
      )}

      {/* ══ Body ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Editor area ── */}
        <main className="flex-1 overflow-hidden flex flex-col bg-background">

          {/* The one editor */}
          {!legacy && activeTab === 'design' && (
            <div className="flex-1 overflow-hidden">
              <SimpleEmailEditor
                key={editorKey}
                initialHtml={editorInitHtml.current}
                subject={formData.subject}
                onSubjectChange={v => set('subject', v)}
                onChange={handleDesignChange}
                variables={formData.variables}
                subjectError={!!errors.subject}
              />
            </div>
          )}

          {/* A template from one of the retired editors: shown as it will send,
              with the two ways forward. */}
          {legacy && activeTab === 'design' && (
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-6">
                <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-on-surface">{t('emailMarketing.templateModal.legacyTitle')}</h3>
                      <p className="mt-1 text-sm leading-6 text-on-surface-variant">{t('emailMarketing.templateModal.legacyBody')}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={importLegacy}
                          className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary transition hover:opacity-90"
                        >
                          {t('emailMarketing.templateModal.legacyImport')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('html')}
                          className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high"
                        >
                          {t('emailMarketing.templateModal.legacyEditHtml')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <iframe
                  title={t('misc.emailPreview')}
                  srcDoc={formData.htmlContent}
                  className="mt-4 h-[60vh] w-full rounded-xl border border-outline-variant/30 bg-white"
                  sandbox=""
                />
              </div>
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

          {/* Preview tab — read-only iframe, with the fields filled in */}
          {activeTab === 'preview' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-center gap-4 border-b border-outline-variant/20 bg-surface-container-low py-2 px-4 text-xs font-medium text-on-surface-variant">
                {t('emailMarketing.templateModal.previewSampleData')}
              </div>
              <div className="border-b border-outline-variant/20 bg-surface-container-lowest px-4 py-2 text-sm">
                <span className="text-on-surface-variant">{t('emailMarketing.simpleEditor.subject')}</span>{' '}
                <span className="font-medium text-on-surface">{renderWithSamples(formData.subject)}</span>
              </div>
              <div className="flex-1 bg-background p-4 overflow-auto flex items-start justify-center">
                {formData.htmlContent ? (
                  <iframe
                    srcDoc={renderWithSamples(formData.htmlContent)}
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

        {/* ── Settings drawer (type, description, variables, tags, plain text) ── */}
        {settingsOpen && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-outline-variant/20 bg-surface-container-low flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
              <span className="text-sm font-semibold text-on-surface">{t('emailMarketing.templateModal.settings')}</span>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label={t('common.close')}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-high transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <Section open={openSections.meta} onToggle={() => toggleSection('meta')} label={t('emailMarketing.templateModal.templateInfo')} icon={FileText}>
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

            <Section open={openSections.variables} onToggle={() => toggleSection('variables')} label={t('emailMarketing.templateModal.variables')} icon={Code}>
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

            <Section open={openSections.tags} onToggle={() => toggleSection('tags')} label={t('emailMarketing.templateModal.tags')} icon={Tag}>
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

            <Section open={openSections.plaintext} onToggle={() => toggleSection('plaintext')} label={t('emailMarketing.templateModal.plainText')} icon={FileText}>
              <p className="text-[11px] text-on-surface-variant mb-1">{t('emailMarketing.templateModal.plainTextHint')}</p>
              <textarea value={formData.textContent}
                onChange={e => { setTextHandwritten(true); set('textContent', e.target.value) }}
                rows={5} placeholder={t('emailMarketing.templateModal.plainTextPlaceholder')}
                className={`${inputCls()} font-mono text-[11px] resize-none`} />
            </Section>

          </aside>
        )}
      </div>
    </div>
  )
}

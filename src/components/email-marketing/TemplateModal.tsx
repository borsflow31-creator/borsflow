'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
    if (!formData.name.trim())    e.name    = 'Required'
    if (!formData.subject.trim()) e.subject = 'Required'
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
      setSaveError(err?.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const Section = ({ id, label, icon: Icon, children }: { id: keyof typeof openSections; label: string; icon: any; children: React.ReactNode }) => (
    <div className="border-b border-stone-100 last:border-0">
      <button
        type="button"
        onClick={() => toggleSection(id)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-widest text-stone-500 hover:bg-stone-50 transition"
      >
        <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{label}</span>
        {openSections[id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {openSections[id] && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )

  const inputCls = (err?: string) =>
    `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${err ? 'border-red-400' : 'border-stone-200'}`

  const tabs: { id: EditorTab; label: string; icon: React.ElementType }[] = [
    { id: 'design',  label: 'Design',  icon: Layout },
    { id: 'html',    label: 'HTML',    icon: Code },
    { id: 'preview', label: 'Preview', icon: Eye },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-100">

      {/* ══ Top bar ══ */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <Wand2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-900 leading-tight">
              {formData.name || (template ? 'Edit Template' : 'New Template')}
            </div>
            {formData.subject && (
              <div className="text-xs text-stone-400 leading-tight truncate max-w-xs">{formData.subject}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Design / HTML / Preview tabs */}
          <div className="flex items-center rounded-lg border border-stone-200 overflow-hidden text-xs font-medium">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition ${i > 0 ? 'border-l border-stone-200' : ''} ${
                  activeTab === tab.id
                    ? tab.id === 'html' ? 'bg-stone-800 text-white' : 'bg-indigo-600 text-white'
                    : 'text-stone-600 hover:bg-stone-50'
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
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition">
            Discard
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving
              ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
              : <><Save className="h-3.5 w-3.5" />{template ? 'Save changes' : 'Create template'}</>
            }
          </button>
          <button type="button" onClick={onClose} className="ml-1 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ══ Body ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-stone-200 bg-white flex flex-col">

          <Section id="meta" label="Template info" icon={FileText}>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Name *</label>
              <input value={formData.name} onChange={e => set('name', e.target.value)}
                placeholder="Welcome Email" className={inputCls(errors.name)} />
              {errors.name && <p className="mt-0.5 text-[11px] text-red-500">{errors.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Subject line *</label>
              <input value={formData.subject} onChange={e => set('subject', e.target.value)}
                placeholder="Hello {{first_name}}!" className={inputCls(errors.subject)} />
              {errors.subject && <p className="mt-0.5 text-[11px] text-red-500">{errors.subject}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Type</label>
              <select value={formData.type} onChange={e => set('type', e.target.value)} className={inputCls()}>
                <option value="marketing">Marketing</option>
                <option value="transactional">Transactional</option>
                <option value="automation">Automation</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Description</label>
              <textarea value={formData.description} onChange={e => set('description', e.target.value)}
                rows={2} placeholder="Optional notes…" className={`${inputCls()} resize-none`} />
            </div>
          </Section>

          <Section id="variables" label="Variables" icon={Code}>
            <div className="flex gap-1.5">
              <input value={newVariable} onChange={e => setNewVariable(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addVariable())}
                placeholder="e.g. first_name" className={`${inputCls()} flex-1`} />
              <button type="button" onClick={addVariable}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {formData.variables.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.variables.map((v, i) => (
                  <div key={i} className="inline-flex items-center overflow-hidden rounded-full border border-blue-200 bg-blue-50">
                    <span className="px-2.5 py-0.5 font-mono text-[11px] text-blue-700">{`{{${v}}}`}</span>
                    <button type="button" onClick={() => set('variables', formData.variables.filter(x => x !== v))}
                      className="px-1.5 py-0.5 text-blue-400 hover:bg-red-50 hover:text-red-500 transition">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {formData.variables.length === 0 && (
              <p className="text-[11px] text-stone-400">Add variables like <span className="font-mono">first_name</span> to personalise the email.</p>
            )}
          </Section>

          <Section id="tags" label="Tags" icon={Tag}>
            <div className="flex gap-1.5">
              <input value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="e.g. onboarding" className={`${inputCls()} flex-1`} />
              <button type="button" onClick={addTag}
                className="flex items-center rounded-lg bg-indigo-600 px-2.5 py-1.5 text-white hover:bg-indigo-700 transition">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.tags.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] text-indigo-700">
                    {t}
                    <button type="button" onClick={() => set('tags', formData.tags.filter(x => x !== t))}
                      className="hover:text-red-500 transition"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section id="plaintext" label="Plain text" icon={FileText}>
            <p className="text-[11px] text-stone-400 mb-1">Fallback for email clients that don&apos;t render HTML.</p>
            <textarea value={formData.textContent} onChange={e => set('textContent', e.target.value)}
              rows={5} placeholder="Plain text version…"
              className={`${inputCls()} font-mono text-[11px] resize-none`} />
          </Section>

          {(errors.name || errors.subject) && (
            <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              Please fill in all required fields before saving.
            </div>
          )}
        </aside>

        {/* ── Editor area ── */}
        <main className="flex-1 overflow-hidden flex flex-col bg-stone-100">

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
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2">
                  <span className="text-xs text-stone-400 mr-1">Variables:</span>
                  {formData.variables.map((v, i) => (
                    <span key={i} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700">
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
                className="flex-1 min-h-[500px] rounded-xl border border-stone-200 bg-white px-4 py-3 font-mono text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none shadow-sm"
                placeholder="Paste or write your HTML email here…"
              />
            </div>
          )}

          {/* Preview tab — read-only iframe */}
          {activeTab === 'preview' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-center gap-4 border-b border-stone-200 bg-white py-2 px-4 text-xs font-medium text-stone-500">
                Preview — read-only
              </div>
              <div className="flex-1 bg-stone-100 p-4 overflow-auto flex items-start justify-center">
                {formData.htmlContent ? (
                  <iframe
                    srcDoc={formData.htmlContent}
                    sandbox="allow-same-origin"
                    title="Template preview"
                    className="rounded-xl border border-stone-200 bg-white shadow-md"
                    style={{ width: 640, minHeight: 600, border: 'none' }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 text-stone-400 mt-20">
                    <Eye className="h-12 w-12 opacity-20" />
                    <p className="text-sm">Nothing to preview yet. Add content in the Design or HTML tab.</p>
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

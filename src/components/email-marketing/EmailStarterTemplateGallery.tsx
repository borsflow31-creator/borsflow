'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { Check, Eye, FilePlus2, Loader2, Pencil, Search, Trash2, X } from 'lucide-react'
import { EmailStarterTemplate, emailStarterTemplates, starterTemplateCategories } from '@/lib/email-starter-templates'

export interface WorkspaceEmailTemplate {
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

interface EmailStarterTemplateGalleryProps {
  workspaceId?: string
  workspaceTemplates?: WorkspaceEmailTemplate[]
  onCloneTemplate?: (template: EmailStarterTemplate) => Promise<void>
  onCreateBlank?: () => void
  onEditWorkspaceTemplate?: (template: WorkspaceEmailTemplate) => void
  onDeleteWorkspaceTemplate?: (id: string) => void
  title?: string
  subtitle?: string
}

export default function EmailStarterTemplateGallery({
  workspaceId,
  workspaceTemplates = [],
  onCloneTemplate,
  onCreateBlank,
  onEditWorkspaceTemplate,
  onDeleteWorkspaceTemplate,
  title,
  subtitle,
}: EmailStarterTemplateGalleryProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [previewTemplate, setPreviewTemplate] = useState<EmailStarterTemplate | WorkspaceEmailTemplate | null>(null)
  const [cloningId, setCloningId] = useState<string | null>(null)
  const [clonedId, setClonedId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const importedNames = useMemo(
    () => new Set(workspaceTemplates.map((template) => template.name.trim().toLowerCase())),
    [workspaceTemplates]
  )

  const starterTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return emailStarterTemplates.filter((template) => {
      const matchesCategory = activeCategory === 'All' || template.category === activeCategory
      const matchesQuery =
        !normalizedQuery ||
        template.name.toLowerCase().includes(normalizedQuery) ||
        template.tagline.toLowerCase().includes(normalizedQuery) ||
        template.description.toLowerCase().includes(normalizedQuery) ||
        template.category.toLowerCase().includes(normalizedQuery) ||
        template.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))

      return matchesCategory && matchesQuery
    })
  }, [activeCategory, query])

  const resolvePreviewImage = (template: EmailStarterTemplate | WorkspaceEmailTemplate) =>
    'highlights' in template ? template.previewImage : null

  const handleClone = async (template: EmailStarterTemplate) => {
    if (!workspaceId || !onCloneTemplate) {
      setError(t('emailMarketing.starterGallery.workspaceRequiredClone'))
      return
    }

    setError(null)
    setStatus(null)
    setCloningId(template.id)

    try {
      await onCloneTemplate(template)
      setClonedId(template.id)
      setStatus(t('emailMarketing.starterGallery.clonedToast', { name: template.name }))
      setTimeout(() => setStatus(null), 4000)
    } catch (cloneError: any) {
      setError(cloneError?.message || t('emailMarketing.starterGallery.cloneFailed'))
      setTimeout(() => setError(null), 6000)
    } finally {
      setCloningId(null)
    }
  }

  return (
    <div className="space-y-8">
      {(title || subtitle) && (
        <section className="rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-6 shadow-sm">
          {title && <h2 className="text-2xl font-semibold tracking-tight text-on-surface">{title}</h2>}
          {subtitle && <p className="mt-2 max-w-3xl text-sm leading-7 text-on-surface-variant">{subtitle}</p>}
        </section>
      )}

      {/* ── Your Templates (saved) ── */}
      {workspaceTemplates.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-on-surface">{t('emailMarketing.starterGallery.yourTemplates')}</h3>
              <p className="mt-0.5 text-sm text-on-surface-variant">{t('emailMarketing.starterGallery.savedSubtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
                {t('emailMarketing.starterGallery.savedCount', { count: workspaceTemplates.length })}
              </span>
              {onCreateBlank && (
                <button
                  type="button"
                  onClick={onCreateBlank}
                  className="inline-flex items-center gap-2 rounded-full border border-secondary bg-secondary px-4 py-2 text-sm font-medium text-on-secondary transition hover:opacity-90"
                >
                  <FilePlus2 className="h-4 w-4" />
                  {t('emailMarketing.starterGallery.newTemplate')}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workspaceTemplates.map((template) => (
              <article
                key={template.id}
                onClick={() => onEditWorkspaceTemplate?.(template)}
                className={`rounded-[24px] border border-outline-variant/20 bg-surface-container-low p-5 shadow-sm transition hover:shadow-md ${onEditWorkspaceTemplate ? 'cursor-pointer hover:border-secondary/40' : ''}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-on-surface">{template.name}</div>
                    <div className="mt-0.5 text-sm text-on-surface-variant line-clamp-1">{template.subject}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-medium capitalize text-on-surface-variant">{template.type}</span>
                </div>

                {template.description && (
                  <p className="mb-3 text-sm leading-5 text-on-surface-variant line-clamp-2">{template.description}</p>
                )}

                {/* Buttons handle their own clicks; don't also trigger the card's edit */}
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(template)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('emailMarketing.starterGallery.preview')}
                  </button>
                  {onEditWorkspaceTemplate && (
                    <button
                      type="button"
                      onClick={() => onEditWorkspaceTemplate(template)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-secondary bg-secondary px-3 py-2 text-sm font-medium text-on-secondary transition hover:opacity-90"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('common.edit')}
                    </button>
                  )}
                  {onDeleteWorkspaceTemplate && (
                    <button
                      type="button"
                      onClick={() => onDeleteWorkspaceTemplate(template.id)}
                      className="inline-flex items-center justify-center rounded-full border border-error/30 px-3 py-2 text-sm text-error transition hover:bg-error/10"
                      title={t('emailMarketing.starterGallery.deleteTemplateTooltip')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        /* Empty state — shown before any template is created */
        <section className="rounded-[28px] border border-dashed border-outline-variant/40 bg-surface-container-high px-8 py-10 text-center">
          <FilePlus2 className="mx-auto mb-3 h-8 w-8 text-on-surface-variant/30" />
          <p className="text-sm font-medium text-on-surface-variant">{t('emailMarketing.starterGallery.emptyTitle')}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{t('emailMarketing.starterGallery.emptySubtitle')}</p>
          {onCreateBlank && (
            <button
              type="button"
              onClick={onCreateBlank}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-secondary bg-secondary px-5 py-2.5 text-sm font-medium text-on-secondary transition hover:opacity-90"
            >
              <FilePlus2 className="h-4 w-4" />
              {t('emailMarketing.starterGallery.createBlank')}
            </button>
          )}
        </section>
      )}

      {/* ── Browse & Clone divider ── */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-outline-variant/20" />
        <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">{t('emailMarketing.starterGallery.browseDivider')}</span>
        <div className="h-px flex-1 bg-outline-variant/20" />
      </div>

      {/* ── Search + filter bar ── */}
      <section className="space-y-4 rounded-[28px] border border-outline-variant/20 bg-surface-container-low p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('emailMarketing.starterGallery.searchPlaceholder')}
              className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-high py-3 pl-11 pr-4 text-sm text-on-surface outline-none transition focus:border-secondary/50 focus:bg-surface-container-lowest"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {starterTemplateCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  activeCategory === category
                    ? 'bg-secondary text-on-secondary shadow-lg shadow-secondary/30'
                    : 'border border-outline-variant/20 bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* inline banners retained for no-workspace error */}
        {error && !status && <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-on-surface-variant">{t('emailMarketing.starterGallery.browseSubtitle')}</p>
          </div>
        </div>

        {starterTemplates.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-outline-variant/40 bg-surface-container-high px-8 py-14 text-center text-on-surface-variant">
            {t('emailMarketing.starterGallery.noMatches')}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {starterTemplates.map((template) => {
              const alreadyImported = importedNames.has(template.name.toLowerCase())

              return (
                <article key={template.id} className="group overflow-hidden rounded-[28px] border border-outline-variant/20 bg-surface-container-low shadow-sm transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(28,25,23,0.08)]">
                  <div className="border-b border-outline-variant/20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),rgba(255,255,255,0.05)),linear-gradient(140deg,#fff7ed,#ffffff_55%,#f5f3ff)] p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-600">
                        {template.category}
                      </span>
                      <span className="text-xs font-medium text-stone-500">{template.mood}</span>
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-sm">
                      <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-on-surface-variant">
                        <span className="px-4 pt-4">{template.metrics.layout}</span>
                        <span className="px-4 pt-4" style={{ color: template.accent }}>{template.type}</span>
                      </div>
                      <div className="space-y-3 px-4 pb-4">
                        <div
                          className="relative h-48 overflow-hidden rounded-[20px] bg-surface-container-high"
                          style={{
                            backgroundImage: `linear-gradient(180deg, transparent, rgba(17,24,39,0.58)), url(${resolvePreviewImage(template)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        >
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <div className="text-xs uppercase tracking-[0.24em] text-on-secondary/75">{template.category}</div>
                            <div className="mt-2 max-w-[15rem] text-lg font-semibold leading-5 text-on-secondary">{template.name}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {template.highlights.map((highlight) => (
                            <div key={highlight} className="rounded-2xl bg-surface-container-high p-3 text-[11px] leading-4 text-on-surface-variant">
                              {highlight}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div>
                      <h4 className="text-xl font-semibold text-on-surface">{template.name}</h4>
                      <p className="mt-1 text-sm text-on-surface-variant">{template.tagline}</p>
                    </div>

                    <p className="text-sm leading-6 text-on-surface-variant">{template.description}</p>

                    <div className="grid grid-cols-3 gap-3 text-xs text-on-surface-variant">
                      <div className="rounded-2xl bg-surface-container-high p-3">
                        <div className="font-semibold text-on-surface">{t('emailMarketing.starterGallery.industry')}</div>
                        <div className="mt-1">{template.metrics.industry}</div>
                      </div>
                      <div className="rounded-2xl bg-surface-container-high p-3">
                        <div className="font-semibold text-on-surface">{t('emailMarketing.starterGallery.useCase')}</div>
                        <div className="mt-1">{template.metrics.useCase}</div>
                      </div>
                      <div className="rounded-2xl bg-surface-container-high p-3">
                        <div className="font-semibold text-on-surface">{t('emailMarketing.starterGallery.subject')}</div>
                        <div className="mt-1 line-clamp-2">{template.subject}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {template.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(template)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-outline-variant/20 px-4 py-3 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high"
                        >
                          <Eye className="h-4 w-4" />
                          {t('emailMarketing.starterGallery.preview')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClone(template)}
                          disabled={!workspaceId || !onCloneTemplate || cloningId === template.id || alreadyImported || clonedId === template.id}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-on-secondary transition disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ backgroundColor: template.accent }}
                        >
                          {cloningId === template.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : (alreadyImported || clonedId === template.id)
                              ? <Check className="h-4 w-4" />
                              : <FilePlus2 className="h-4 w-4" />}
                          {alreadyImported || clonedId === template.id
                            ? t('emailMarketing.starterGallery.imported')
                            : cloningId === template.id
                              ? t('emailMarketing.starterGallery.cloning')
                              : t('emailMarketing.starterGallery.cloneTemplate')}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>


      {/* Fixed toast notifications */}
      {(status || (error && status == null)) && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          {status && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 px-5 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300 shadow-lg">
              <Check className="h-4 w-4 shrink-0" />
              {status}
            </div>
          )}
          {error && !status && (
            <div className="flex items-center gap-3 rounded-2xl border border-error/20 bg-error/10 px-5 py-3 text-sm font-medium text-error shadow-lg">
              <X className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-6xl overflow-hidden rounded-[32px] bg-surface-container-lowest border border-outline-variant/30 shadow-2xl" style={{ maxHeight: '92vh' }}>
            {/* Close button */}
            <button
              type="button"
              onClick={() => setPreviewTemplate(null)}
              className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant shadow-sm transition hover:bg-surface-container-high"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Left panel — metadata */}
            <div className="hidden w-80 shrink-0 overflow-y-auto border-r border-outline-variant/10 p-7 lg:block">
              <div className="space-y-5">
                {'previewImage' in previewTemplate && (
                  <div
                    className="h-40 w-full rounded-[20px] bg-surface-container-high"
                    style={{
                      backgroundImage: `linear-gradient(180deg, transparent 40%, rgba(17,24,39,0.5)), url(${previewTemplate.previewImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                )}

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                    {'category' in previewTemplate ? previewTemplate.category : t('emailMarketing.starterGallery.savedTemplateFallback')}
                  </div>
                  <h3 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-on-surface">
                    {previewTemplate.name}
                  </h3>
                  <p className="mt-2.5 text-sm leading-6 text-on-surface-variant">
                    {'description' in previewTemplate
                      ? previewTemplate.description || t('emailMarketing.starterGallery.previewFallbackDescription')
                      : t('emailMarketing.starterGallery.previewFallbackDescription')}
                  </p>
                </div>

                <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-high px-4 py-3.5 text-sm">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{t('emailMarketing.starterGallery.subjectLineLabel')}</div>
                  <div className="text-on-surface">{previewTemplate.subject}</div>
                </div>

                {'highlights' in previewTemplate && previewTemplate.highlights.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{t('emailMarketing.starterGallery.whyItWorks')}</div>
                    {previewTemplate.highlights.map((highlight) => (
                      <div key={highlight} className="rounded-xl border border-outline-variant/10 bg-surface-container-high px-3.5 py-2.5 text-xs leading-5 text-on-surface-variant">
                        {highlight}
                      </div>
                    ))}
                  </div>
                )}

                {'variables' in previewTemplate && Array.isArray(previewTemplate.variables) && previewTemplate.variables.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{t('emailMarketing.starterGallery.variablesLabel')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {previewTemplate.variables.map((variable) => (
                        <span key={variable} className="rounded-full border border-outline-variant/20 bg-surface-container-lowest px-2.5 py-1 font-mono text-[11px] text-on-surface-variant">
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel — email preview */}
            <div className="flex flex-1 flex-col overflow-hidden bg-surface-container-high">
              {/* Preview toolbar */}
              <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant/20 bg-surface-container-low px-5 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-rose-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 rounded-lg bg-surface-container-high px-3 py-1.5 text-center text-xs text-on-surface-variant truncate">
                  {previewTemplate.name}
                </div>
              </div>
              {/* iframe */}
              <div className="flex-1 overflow-hidden p-4">
                <div className="h-full overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm">
                  <iframe
                    title={`${previewTemplate.name} preview`}
                    srcDoc={
                      previewTemplate.htmlContent
                        ? previewTemplate.htmlContent
                        : `<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:300px;font-family:system-ui,sans-serif;color:#78716c;font-size:14px;">No HTML preview available for this template.</div>`
                    }
                    className="h-full w-full"
                    style={{ minHeight: '60vh' }}
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

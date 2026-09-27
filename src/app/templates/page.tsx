'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import AppShell from '@/components/AppShell'
import NoWorkspace from '@/components/NoWorkspace'
import EmailStarterTemplateGallery, { WorkspaceEmailTemplate } from '@/components/email-marketing/EmailStarterTemplateGallery'
import { EmailStarterTemplate } from '@/lib/email-starter-templates'
import { useAppStore } from '@/store/appStore'
import { ArrowRight, Loader2 } from 'lucide-react'

function TemplatesPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { currentWorkspaceId, setWorkspace } = useAppStore()
  const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState('')
  const [templates, setTemplates] = useState<WorkspaceEmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const workspaceId = resolvedWorkspaceId

  useEffect(() => {
    const fromUrl = searchParams.get('workspace')
    if (fromUrl) {
      setResolvedWorkspaceId(fromUrl)
      return
    }

    if (currentWorkspaceId) {
      setResolvedWorkspaceId(currentWorkspaceId)
      return
    }

    if (session?.user) {
      fetch('/api/workspaces')
        .then((response) => response.json())
        .then((data) => {
          const workspace = Array.isArray(data) ? data[0] : data?.workspaces?.[0]
          if (workspace?.id) {
            setWorkspace(workspace.id)
            setResolvedWorkspaceId(workspace.id)
          }
        })
        .catch(() => {})
    }
  }, [currentWorkspaceId, searchParams, session, setWorkspace])

  const fetchTemplates = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/email-marketing/templates?workspaceId=${workspaceId}`)
      const data = await response.json()
      if (response.ok) {
        setTemplates(data.templates || [])
      }
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleCloneTemplate = async (template: EmailStarterTemplate) => {
    const response = await fetch('/api/email-marketing/templates', {
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

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Failed to clone template')
    }

    await fetchTemplates()
  }

  if (status === 'loading') {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-stone-100">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      </AppShell>
    )
  }

  if (!workspaceId) {
    return <NoWorkspace />
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[linear-gradient(180deg,#f9f4ec_0%,#f5f5f4_28%,#ffffff_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="flex flex-col gap-4 rounded-[32px] border border-stone-200 bg-white/80 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">Templates route</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">Email layouts you can actually ship</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
                This page now acts as a dedicated email-template gallery, with BeeFree-inspired starter layouts that clone directly into your workspace library.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/email-marketing')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-900 bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              Open email marketing
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="rounded-[28px] border border-stone-200 bg-white p-16 text-center text-stone-500 shadow-sm">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
              Loading your template library...
            </div>
          ) : (
            <EmailStarterTemplateGallery
              workspaceId={workspaceId}
              workspaceTemplates={templates}
              onCloneTemplate={handleCloneTemplate}
              onCreateBlank={() => router.push('/email-marketing')}
              onEditWorkspaceTemplate={(template) => router.push(`/email-marketing?tab=templates&editTemplate=${template.id}`)}
              title="Curated email template collection"
              subtitle="Designed to feel close to the BeeFree browsing experience: polished preview cards, strong categorization, and ready-to-clone layouts for launches, newsletters, webinars, recovery flows, and more."
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex min-h-screen items-center justify-center bg-stone-100">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
          </div>
        </AppShell>
      }
    >
      <TemplatesPageInner />
    </Suspense>
  )
}

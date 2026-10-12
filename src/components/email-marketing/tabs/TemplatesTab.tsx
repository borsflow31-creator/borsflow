'use client'

/**
 * Templates: the starter gallery and the workspace's saved templates.
 */

import { RefreshCw } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import type { EmailTemplate } from '../types'
import EmailStarterTemplateGallery from '../EmailStarterTemplateGallery'

export default function TemplatesTab({
  workspaceId,
  templates,
  loading,
  onCloneStarter,
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
  onEdit: (t: EmailTemplate) => void
  onCreate: () => void
  onDelete: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">
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
            onCreateBlank={onCreate}
            onEditWorkspaceTemplate={onEdit}
            onDeleteWorkspaceTemplate={onDelete}
          />
        </div>
      )}
    </div>
  )
}

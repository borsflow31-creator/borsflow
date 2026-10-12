'use client'

/**
 * Automations: the drip sequences, what starts them and when they run.
 */

import { Users, Plus, Edit, Trash2, Play, Pause, Zap, RefreshCw } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import type { EmailAutomation } from '../types'
import { statusLabel, type TFunction } from '../status'

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

export default function AutomationsTab({ automations, loading, onCreate, onEdit, onToggle, onDelete }: {
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
        <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">
          {t('emailMarketing.automationsTab.heading')}
        </h2>
        <p className="text-on-surface-variant">
          {t('emailMarketing.automationsTab.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-secondary">{automations.length}</div>
            <Zap className="h-8 w-8 text-secondary/20" />
          </div>
          <div className="text-on-surface-variant">{t('emailMarketing.automationsTab.statAutomations')}</div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-green-600">{active.length}</div>
            <Play className="h-8 w-8 text-green-200 dark:text-green-900/40" />
          </div>
          <div className="text-on-surface-variant">{t('emailMarketing.automationsTab.statRunning')}</div>
        </div>
        <div className="bg-surface-container-low rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600">
              {automations.reduce((acc, a) => acc + (a.activeEnrolled || 0), 0).toLocaleString()}
            </div>
            <Users className="h-8 w-8 text-blue-200 dark:text-blue-900/40" />
          </div>
          <div className="text-on-surface-variant">{t('emailMarketing.automationsTab.statLeadsInSequence')}</div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-lg shadow">
        <div className="p-4 sm:p-6 border-b border-outline-variant/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
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
              <div key={automation.id} className="p-4 sm:p-6 hover:bg-surface-container-high transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                      <h4 className="text-base font-medium text-on-surface truncate">{automation.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        automation.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : automation.status === 'paused'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400'
                      }`}>
                        {statusLabel(automation.status, t)}
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
                      aria-label={automation.status === 'active' ? t('emailMarketing.automationsTab.pause') : t('emailMarketing.automationsTab.activate')}
                    >
                      {automation.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => onEdit(automation)}
                      className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(automation.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
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

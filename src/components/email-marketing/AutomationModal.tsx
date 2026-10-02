/**
 * Automation Modal Component
 *
 * Modal for creating and editing pipeline-triggered email automations.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useI18n, type MessageKey } from '@/i18n/I18nProvider'
import { X, Zap, Plus, Trash2, Loader2, GitBranch, Mail, ArrowUp, ArrowDown, Clock } from 'lucide-react'

type TFunction = (key: MessageKey, values?: Record<string, string | number>) => string

interface Pipeline {
  id: string
  name: string
  stages: string[]
}

interface StepDraft {
  name: string
  templateId: string
  delayValue: number
  delayUnit: 'minutes' | 'hours' | 'days'
}

interface AutomationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (automation: any) => void | Promise<void>
  automation?: any
  workspaceId: string
  templates: any[]
}

const UNIT_MINUTES: Record<StepDraft['delayUnit'], number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
}

/** Pick the largest unit that divides cleanly, so 2880 reads as "2 days". */
function fromMinutes(total: number): { delayValue: number; delayUnit: StepDraft['delayUnit'] } {
  if (total > 0 && total % UNIT_MINUTES.days === 0) {
    return { delayValue: total / UNIT_MINUTES.days, delayUnit: 'days' }
  }
  if (total > 0 && total % UNIT_MINUTES.hours === 0) {
    return { delayValue: total / UNIT_MINUTES.hours, delayUnit: 'hours' }
  }
  return { delayValue: total, delayUnit: 'minutes' }
}

function toMinutes(step: StepDraft): number {
  return Math.max(0, Math.floor(step.delayValue)) * UNIT_MINUTES[step.delayUnit]
}

function unitLabel(unit: StepDraft['delayUnit'], value: number, t: TFunction): string {
  const singular = value === 1
  if (unit === 'minutes') return singular ? t('emailMarketing.automationModal.unitMinute') : t('emailMarketing.automationModal.unitMinutes')
  if (unit === 'hours') return singular ? t('emailMarketing.automationModal.unitHour') : t('emailMarketing.automationModal.unitHours')
  return singular ? t('emailMarketing.automationModal.unitDay') : t('emailMarketing.automationModal.unitDays')
}

function describeDelay(step: StepDraft, index: number, t: TFunction): string {
  const minutes = toMinutes(step)
  if (minutes === 0) {
    return index === 0
      ? t('emailMarketing.automationModal.sendsImmediatelyFirst')
      : t('emailMarketing.automationModal.sendsImmediatelyAfterPrevious')
  }
  const { delayValue, delayUnit } = fromMinutes(minutes)
  const unit = unitLabel(delayUnit, delayValue, t)
  return index === 0
    ? t('emailMarketing.automationModal.sendsAfterFirst', { value: delayValue, unit })
    : t('emailMarketing.automationModal.sendsAfterStep', { value: delayValue, unit, step: index })
}

function emptyStep(index: number): StepDraft {
  return {
    name: `Step ${index + 1}`,
    templateId: '',
    delayValue: index === 0 ? 0 : 2,
    delayUnit: index === 0 ? 'minutes' : 'days',
  }
}

export default function AutomationModal({
  isOpen,
  onClose,
  onSave,
  automation,
  workspaceId,
  templates,
}: AutomationModalProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pipelineId: '',
    toStage: '',
    fromStage: '',
  })

  const [steps, setSteps] = useState<StepDraft[]>([emptyStep(0)])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loadingPipelines, setLoadingPipelines] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !workspaceId) return

    let cancelled = false
    setLoadingPipelines(true)

    fetch(`/api/pipelines?workspaceId=${workspaceId}`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : data?.pipelines ?? []
        setPipelines(
          list.map((p: any) => ({
            id: p.id,
            name: p.name,
            stages: Array.isArray(p.stages) ? p.stages : [],
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setPipelines([])
      })
      .finally(() => {
        if (!cancelled) setLoadingPipelines(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, workspaceId])

  useEffect(() => {
    if (!isOpen) return

    if (automation) {
      let conditions: any = {}
      try {
        conditions = JSON.parse(automation.triggers?.[0]?.conditions || '{}')
      } catch {
        conditions = {}
      }

      setFormData({
        name: automation.name || '',
        description: automation.description || '',
        pipelineId: conditions.pipelineId || '',
        toStage: conditions.toStage || '',
        fromStage: conditions.fromStage || '',
      })

      const existing = (automation.steps || []).map((s: any, index: number) => ({
        name: s.name || `Step ${index + 1}`,
        templateId: s.templateId || '',
        ...fromMinutes(s.delayMinutes ?? 0),
      }))

      setSteps(existing.length > 0 ? existing : [emptyStep(0)])
    } else {
      setFormData({ name: '', description: '', pipelineId: '', toStage: '', fromStage: '' })
      setSteps([emptyStep(0)])
    }

    setErrors({})
  }, [automation, isOpen])

  const selectedPipeline = useMemo(
    () => pipelines.find(p => p.id === formData.pipelineId),
    [pipelines, formData.pipelineId]
  )

  // An automation edited while running would move live enrollments to the wrong
  // message, so the API rejects step changes until it is paused.
  const locked = automation?.status === 'active'

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const addStep = () => setSteps(prev => [...prev, emptyStep(prev.length)])

  const removeStep = (index: number) => {
    setSteps(prev => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target > steps.length - 1) return
    setSteps(prev => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}

    if (!formData.name.trim()) next.name = t('emailMarketing.automationModal.nameRequired')
    if (!formData.pipelineId) next.pipelineId = t('emailMarketing.automationModal.pipelineRequired')
    if (!formData.toStage) next.toStage = t('emailMarketing.automationModal.toStageRequired')

    steps.forEach((step, index) => {
      if (!step.name.trim()) next[`step-${index}-name`] = t('emailMarketing.automationModal.stepNameRequired')
      if (!step.templateId) next[`step-${index}-template`] = t('emailMarketing.automationModal.stepTemplateRequired')
      if (!Number.isFinite(step.delayValue) || step.delayValue < 0) {
        next[`step-${index}-delay`] = t('emailMarketing.automationModal.stepDelayInvalid')
      }
    })

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      await onSave({
        workspaceId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        type: 'trigger',
        triggers: [
          {
            type: 'stage_changed',
            conditions: {
              pipelineId: formData.pipelineId,
              toStage: formData.toStage,
              ...(formData.fromStage && { fromStage: formData.fromStage }),
            },
          },
        ],
        // A running automation's steps are locked server-side; leave them out so
        // renaming or re-describing it still saves.
        ...(locked ? {} : {
          steps: steps.map(step => ({
            name: step.name.trim(),
            templateId: step.templateId,
            delayMinutes: toMinutes(step),
          })),
        }),
      })
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
            <Zap className="h-6 w-6 text-secondary" />
            <h2 className="text-xl font-semibold text-on-surface">
              {automation ? t('emailMarketing.automationModal.editTitle') : t('emailMarketing.automationModal.createTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {locked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
              {t('emailMarketing.automationModal.lockedNotice')}
            </div>
          )}

          {/* Basics */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Mail className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.automationModal.basics')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('emailMarketing.automationModal.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.automationModal.namePlaceholder')}
                />
                {errors.name && <p className="mt-1 text-sm text-error">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('emailMarketing.automationModal.description')}</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.automationModal.descriptionPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Trigger */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-1 flex items-center">
              <GitBranch className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.automationModal.trigger')}
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">
              {t('emailMarketing.automationModal.triggerSubtitle')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('emailMarketing.automationModal.pipeline')}</label>
                <select
                  value={formData.pipelineId}
                  onChange={e =>
                    setFormData({ ...formData, pipelineId: e.target.value, toStage: '', fromStage: '' })
                  }
                  disabled={loadingPipelines}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.pipelineId ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                >
                  <option value="">{loadingPipelines ? t('emailMarketing.automationModal.loadingOption') : t('emailMarketing.automationModal.selectPipeline')}</option>
                  {pipelines.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.pipelineId && <p className="mt-1 text-sm text-error">{errors.pipelineId}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">{t('emailMarketing.automationModal.enteringStage')}</label>
                <select
                  value={formData.toStage}
                  onChange={e => setFormData({ ...formData, toStage: e.target.value })}
                  disabled={!selectedPipeline}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.toStage ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                >
                  <option value="">{selectedPipeline ? t('emailMarketing.automationModal.selectStage') : t('emailMarketing.automationModal.pickPipelineFirst')}</option>
                  {selectedPipeline?.stages.map(stage => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
                {errors.toStage && <p className="mt-1 text-sm text-error">{errors.toStage}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.automationModal.onlyFromStage')}
                </label>
                <select
                  value={formData.fromStage}
                  onChange={e => setFormData({ ...formData, fromStage: e.target.value })}
                  disabled={!selectedPipeline}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                >
                  <option value="">{t('emailMarketing.automationModal.anyStage')}</option>
                  {selectedPipeline?.stages
                    .filter(stage => stage !== formData.toStage)
                    .map(stage => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {selectedPipeline && formData.toStage && (
              <p className="mt-3 text-sm text-on-surface-variant">
                {formData.fromStage
                  ? t('emailMarketing.automationModal.runsWhenFrom', {
                      fromStage: formData.fromStage,
                      toStage: formData.toStage,
                      pipeline: selectedPipeline.name,
                    })
                  : t('emailMarketing.automationModal.runsWhen', {
                      toStage: formData.toStage,
                      pipeline: selectedPipeline.name,
                    })}
              </p>
            )}
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-medium text-on-surface flex items-center">
                <Clock className="h-5 w-5 mr-2 text-secondary" />
                {t('emailMarketing.automationModal.steps')}
              </h3>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center px-3 py-1.5 text-sm text-secondary hover:bg-secondary/15 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('emailMarketing.automationModal.addStep')}
              </button>
            </div>
            <p className="text-sm text-on-surface-variant mb-4">
              {t('emailMarketing.automationModal.stepsSubtitle')}
            </p>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="border border-outline-variant/20 bg-surface-container-high rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-secondary/15 text-secondary text-sm font-medium">
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                        title={t('emailMarketing.automationModal.moveUp')}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(index, 'down')}
                        disabled={index === steps.length - 1}
                        className="p-1.5 text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                        title={t('emailMarketing.automationModal.moveDown')}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        disabled={steps.length === 1}
                        className="p-1.5 text-error hover:bg-error/10 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                        title={t('emailMarketing.automationModal.removeStep')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-1">{t('emailMarketing.automationModal.stepName')}</label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={e => updateStep(index, { name: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                          errors[`step-${index}-name`] ? 'border-red-500' : 'border-outline-variant/40'
                        }`}
                        placeholder={t('emailMarketing.automationModal.stepNamePlaceholder')}
                      />
                      {errors[`step-${index}-name`] && (
                        <p className="mt-1 text-sm text-error">{errors[`step-${index}-name`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-1">{t('emailMarketing.automationModal.templateLabel')}</label>
                      <select
                        value={step.templateId}
                        onChange={e => updateStep(index, { templateId: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                          errors[`step-${index}-template`] ? 'border-red-500' : 'border-outline-variant/40'
                        }`}
                      >
                        <option value="">{t('emailMarketing.automationModal.selectTemplate')}</option>
                        {templates.map((tpl: any) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                      </select>
                      {errors[`step-${index}-template`] && (
                        <p className="mt-1 text-sm text-error">{errors[`step-${index}-template`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-1">
                        {index === 0 ? t('emailMarketing.automationModal.delayAfterStage') : t('emailMarketing.automationModal.delayAfterPrevious')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          value={step.delayValue}
                          onChange={e => updateStep(index, { delayValue: Number(e.target.value) })}
                          className={`w-28 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                            errors[`step-${index}-delay`] ? 'border-red-500' : 'border-outline-variant/40'
                          }`}
                        />
                        <select
                          value={step.delayUnit}
                          onChange={e =>
                            updateStep(index, { delayUnit: e.target.value as StepDraft['delayUnit'] })
                          }
                          className="flex-1 px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                        >
                          <option value="minutes">{t('emailMarketing.automationModal.minutes')}</option>
                          <option value="hours">{t('emailMarketing.automationModal.hours')}</option>
                          <option value="days">{t('emailMarketing.automationModal.days')}</option>
                        </select>
                      </div>
                      {errors[`step-${index}-delay`] && (
                        <p className="mt-1 text-sm text-error">{errors[`step-${index}-delay`]}</p>
                      )}
                    </div>

                    <div className="flex items-end">
                      <p className="text-sm text-on-surface-variant">{describeDelay(step, index, t)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2 bg-secondary text-on-secondary rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {automation ? t('emailMarketing.automationModal.saveAutomation') : t('emailMarketing.automationModal.createAutomationButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

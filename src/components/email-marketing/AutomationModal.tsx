/**
 * Automation Modal Component
 *
 * Modal for creating and editing pipeline-triggered email automations.
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Zap, Plus, Trash2, Loader2, GitBranch, Mail, ArrowUp, ArrowDown, Clock } from 'lucide-react'

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

function describeDelay(step: StepDraft, index: number): string {
  const minutes = toMinutes(step)
  if (minutes === 0) {
    return index === 0 ? 'Sends as soon as the lead enters the stage' : 'Sends right after the previous step'
  }
  const { delayValue, delayUnit } = fromMinutes(minutes)
  const unit = delayValue === 1 ? delayUnit.replace(/s$/, '') : delayUnit
  return index === 0
    ? `Sends ${delayValue} ${unit} after the lead enters the stage`
    : `Sends ${delayValue} ${unit} after step ${index}`
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

    if (!formData.name.trim()) next.name = 'Give the automation a name'
    if (!formData.pipelineId) next.pipelineId = 'Choose a pipeline'
    if (!formData.toStage) next.toStage = 'Choose the stage that starts the sequence'

    steps.forEach((step, index) => {
      if (!step.name.trim()) next[`step-${index}-name`] = 'Name this step'
      if (!step.templateId) next[`step-${index}-template`] = 'Choose a template'
      if (!Number.isFinite(step.delayValue) || step.delayValue < 0) {
        next[`step-${index}-delay`] = 'Delay must be zero or more'
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
        steps: steps.map(step => ({
          name: step.name.trim(),
          templateId: step.templateId,
          delayMinutes: toMinutes(step),
        })),
      })
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
            <Zap className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {automation ? 'Edit Automation' : 'Create Automation'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {locked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This automation is active. Pause it before changing its steps &mdash; leads
              part-way through a sequence are tracked by step position.
            </div>
          )}

          {/* Basics */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Mail className="h-5 w-5 mr-2 text-indigo-600" />
              Basics
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Proposal follow-up"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="What this sequence is for..."
                />
              </div>
            </div>
          </div>

          {/* Trigger */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-1 flex items-center">
              <GitBranch className="h-5 w-5 mr-2 text-indigo-600" />
              Trigger
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              The sequence starts when a lead moves into the stage you pick here.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline *</label>
                <select
                  value={formData.pipelineId}
                  onChange={e =>
                    setFormData({ ...formData, pipelineId: e.target.value, toStage: '', fromStage: '' })
                  }
                  disabled={loadingPipelines}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.pipelineId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">{loadingPipelines ? 'Loading...' : 'Select a pipeline'}</option>
                  {pipelines.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.pipelineId && <p className="mt-1 text-sm text-red-600">{errors.pipelineId}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entering stage *</label>
                <select
                  value={formData.toStage}
                  onChange={e => setFormData({ ...formData, toStage: e.target.value })}
                  disabled={!selectedPipeline}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.toStage ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">{selectedPipeline ? 'Select a stage' : 'Pick a pipeline first'}</option>
                  {selectedPipeline?.stages.map(stage => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
                {errors.toStage && <p className="mt-1 text-sm text-red-600">{errors.toStage}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Only from stage
                </label>
                <select
                  value={formData.fromStage}
                  onChange={e => setFormData({ ...formData, fromStage: e.target.value })}
                  disabled={!selectedPipeline}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Any stage</option>
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
              <p className="mt-3 text-sm text-gray-600">
                Runs when a lead moves
                {formData.fromStage ? ` from "${formData.fromStage}"` : ''} into &quot;
                {formData.toStage}&quot; in {selectedPipeline.name}. It stops if the lead
                leaves that stage before the sequence finishes.
              </p>
            )}
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-indigo-600" />
                Steps
              </h3>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add step
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Each delay is measured from the step before it, not from enrollment.
            </p>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(index, 'down')}
                        disabled={index === steps.length - 1}
                        className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        disabled={steps.length === 1}
                        className="p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
                        title="Remove step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Step name *</label>
                      <input
                        type="text"
                        value={step.name}
                        onChange={e => updateStep(index, { name: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                          errors[`step-${index}-name`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="e.g., Send the proposal recap"
                      />
                      {errors[`step-${index}-name`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`step-${index}-name`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Template *</label>
                      <select
                        value={step.templateId}
                        onChange={e => updateStep(index, { templateId: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                          errors[`step-${index}-template`] ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select a template</option>
                        {templates.map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {errors[`step-${index}-template`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`step-${index}-template`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {index === 0 ? 'Delay after entering the stage' : 'Delay after the previous step'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          value={step.delayValue}
                          onChange={e => updateStep(index, { delayValue: Number(e.target.value) })}
                          className={`w-28 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                            errors[`step-${index}-delay`] ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        <select
                          value={step.delayUnit}
                          onChange={e =>
                            updateStep(index, { delayUnit: e.target.value as StepDraft['delayUnit'] })
                          }
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                      {errors[`step-${index}-delay`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`step-${index}-delay`]}</p>
                      )}
                    </div>

                    <div className="flex items-end">
                      <p className="text-sm text-gray-600">{describeDelay(step, index)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {automation ? 'Save Automation' : 'Create Automation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

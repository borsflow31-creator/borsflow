'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { cachedJson } from '@/lib/client-cache'

export interface PipelineOption {
  id: string
  name: string
  stages: string[]
}

/** Criteria a pipeline/stage pick turns into. `required` keeps them AND-ed even in an "any of" segment. */
export function pipelineCriteria(pipelineId: string, stages: string[]) {
  const criteria: { field: string; operator: string; value: any; required: true }[] = []
  if (pipelineId) criteria.push({ field: 'pipelineId', operator: 'equals', value: pipelineId, required: true })
  if (stages.length > 0) criteria.push({ field: 'stage', operator: 'in', value: stages, required: true })
  return criteria
}

/** Splits saved criteria back into the pipeline/stage pick and the remaining free-form conditions. */
export function splitPipelineCriteria<T extends { field: string; value: any; required?: boolean }>(criteria: T[]) {
  let pipelineId = ''
  let stages: string[] = []
  const rest: T[] = []
  for (const c of criteria) {
    if (c.required && c.field === 'pipelineId') pipelineId = String(c.value)
    else if (c.required && c.field === 'stage' && Array.isArray(c.value)) stages = c.value.map(String)
    else rest.push(c)
  }
  return { pipelineId, stages, rest }
}

export function usePipelines(workspaceId: string, enabled = true) {
  const [pipelines, setPipelines] = useState<PipelineOption[]>([])
  useEffect(() => {
    if (!enabled || !workspaceId) return
    let cancelled = false
    cachedJson<any[]>(`/api/pipelines?workspaceId=${workspaceId}`)
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return
        setPipelines(data.map((p) => ({ id: p.id, name: p.name, stages: Array.isArray(p.stages) ? p.stages : [] })))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [workspaceId, enabled])
  return pipelines
}

interface PipelineStagePickerProps {
  pipelines: PipelineOption[]
  pipelineId: string
  stages: string[]
  onChange: (pipelineId: string, stages: string[]) => void
  /** Label for the empty pipeline option, e.g. "Any pipeline" or "Select a pipeline". */
  emptyLabel: string
}

export default function PipelineStagePicker({ pipelines, pipelineId, stages, onChange, emptyLabel }: PipelineStagePickerProps) {
  const { t } = useI18n()
  const selected = pipelines.find((p) => p.id === pipelineId)

  const toggleStage = (stage: string) =>
    onChange(pipelineId, stages.includes(stage) ? stages.filter((s) => s !== stage) : [...stages, stage])

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1">{t('emailMarketing.pipelinePicker.pipeline')}</label>
        <select
          value={pipelineId}
          onChange={(e) => onChange(e.target.value, [])}
          className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
        >
          <option value="">{emptyLabel}</option>
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {selected && selected.stages.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">{t('emailMarketing.pipelinePicker.stages')}</label>
          <p className="mb-2 text-xs text-on-surface-variant">{t('emailMarketing.pipelinePicker.stagesHint')}</p>
          <div className="flex flex-wrap gap-2">
            {selected.stages.map((stage) => {
              const active = stages.includes(stage)
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => toggleStage(stage)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    active
                      ? 'bg-secondary text-on-secondary'
                      : 'border border-outline-variant/40 bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                  }`}
                >
                  {stage}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

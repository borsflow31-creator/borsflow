/**
 * Segment Modal Component
 * 
 * Modal for creating and editing customer segments
 */

'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { X, Target, Plus, Trash2, Filter, GitBranch } from 'lucide-react'
import PipelineStagePicker, { pipelineCriteria, splitPipelineCriteria, usePipelines } from './PipelineStagePicker'

interface Condition {
  field: string
  operator: string
  value: string
  required?: boolean
}

interface SegmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (segment: any) => void
  segment?: any
  workspaceId: string
}

export default function SegmentModal({
  isOpen,
  onClose,
  onSave,
  segment,
  workspaceId
}: SegmentModalProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logicOperator: 'AND',
    criteria: [] as Condition[],
    tags: [] as string[]
  })
  const [pipelineId, setPipelineId] = useState('')
  const [stages, setStages] = useState<string[]>([])
  const pipelines = usePipelines(workspaceId, isOpen)

  const [newTag, setNewTag] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // These must be real Lead column names — criteria are evaluated against the
  // lead object, so a field that doesn't exist silently matches nothing.
  const availableFields = [
    { value: 'firstName', label: t('emailMarketing.segmentModal.fieldFirstName') },
    { value: 'lastName', label: t('emailMarketing.segmentModal.fieldLastName') },
    { value: 'email', label: t('emailMarketing.segmentModal.fieldEmail') },
    { value: 'phone', label: t('emailMarketing.segmentModal.fieldPhone') },
    { value: 'status', label: t('emailMarketing.segmentModal.fieldStatus') },
    { value: 'stage', label: t('emailMarketing.segmentModal.fieldStage') },
    { value: 'pipeline.name', label: t('emailMarketing.segmentModal.fieldPipelineName') },
    { value: 'value', label: t('emailMarketing.segmentModal.fieldDealValue') },
    { value: 'company', label: t('emailMarketing.segmentModal.fieldCompany') },
    { value: 'position', label: t('emailMarketing.segmentModal.fieldPosition') },
    { value: 'source', label: t('emailMarketing.segmentModal.fieldSource') },
    { value: 'tags', label: t('emailMarketing.segmentModal.fieldTags') },
    { value: 'createdAt', label: t('emailMarketing.segmentModal.fieldCreatedDate') },
    { value: 'updatedAt', label: t('emailMarketing.segmentModal.fieldUpdatedDate') }
  ]

  const operators = [
    { value: 'equals', label: t('emailMarketing.segmentModal.opEquals') },
    { value: 'not_equals', label: t('emailMarketing.segmentModal.opNotEquals') },
    { value: 'contains', label: t('emailMarketing.segmentModal.opContains') },
    { value: 'not_contains', label: t('emailMarketing.segmentModal.opNotContains') },
    { value: 'starts_with', label: t('emailMarketing.segmentModal.opStartsWith') },
    { value: 'ends_with', label: t('emailMarketing.segmentModal.opEndsWith') },
    { value: 'greater_than', label: t('emailMarketing.segmentModal.opGreaterThan') },
    { value: 'less_than', label: t('emailMarketing.segmentModal.opLessThan') },
    { value: 'is_empty', label: t('emailMarketing.segmentModal.opIsEmpty') },
    { value: 'is_not_empty', label: t('emailMarketing.segmentModal.opIsNotEmpty') }
  ]

  useEffect(() => {
    if (!isOpen) return
    if (segment) {
      const saved: Condition[] = segment.criteria
        ? (typeof segment.criteria === 'string' ? JSON.parse(segment.criteria) : segment.criteria)
        : []
      const split = splitPipelineCriteria(saved)
      setPipelineId(split.pipelineId)
      setStages(split.stages)
      setFormData({
        name: segment.name || '',
        description: segment.description || '',
        logicOperator: segment.logicOperator || 'AND',
        criteria: split.rest,
        tags: segment.tags
          ? (typeof segment.tags === 'string' ? JSON.parse(segment.tags) : segment.tags)
          : []
      })
    } else {
      setPipelineId('')
      setStages([])
      setFormData({ name: '', description: '', logicOperator: 'AND', criteria: [], tags: [] })
    }
    setErrors({})
  }, [segment, isOpen])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleAddCondition = () => {
    setFormData(prev => ({
      ...prev,
      criteria: [...prev.criteria, { field: 'firstName', operator: 'equals', value: '' }]
    }))
  }

  const handleUpdateCondition = (index: number, field: keyof Condition, value: string) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((condition, i) =>
        i === index ? { ...condition, [field]: value } : condition
      )
    }))
  }

  const handleRemoveCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index)
    }))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = t('emailMarketing.segmentModal.nameRequired')
    }
    if (formData.criteria.length === 0 && !pipelineId) {
      newErrors.criteria = t('emailMarketing.segmentModal.criteriaRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSaving(true)

    try {
      const segmentData = {
        ...formData,
        workspaceId,
        criteria: JSON.stringify([...pipelineCriteria(pipelineId, stages), ...formData.criteria]),
        tags: JSON.stringify(formData.tags)
      }

      await onSave(segmentData)
      onClose()
    } catch (error) {
      console.error('Error saving segment:', error)
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
            <Target className="h-6 w-6 text-secondary" />
            <h2 className="text-xl font-semibold text-on-surface">
              {segment ? t('emailMarketing.segmentModal.editTitle') : t('emailMarketing.segmentModal.createTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.segmentModal.basicInformation')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.segmentModal.segmentName')}
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.segmentModal.segmentNamePlaceholder')}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.segmentModal.description')}
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.segmentModal.descriptionPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* CRM pipeline */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-1 flex items-center">
              <GitBranch className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.pipelinePicker.sectionTitle')}
            </h3>
            <p className="mb-4 text-sm text-on-surface-variant">{t('emailMarketing.pipelinePicker.sectionHint')}</p>
            <PipelineStagePicker
              pipelines={pipelines}
              pipelineId={pipelineId}
              stages={stages}
              emptyLabel={t('emailMarketing.pipelinePicker.anyPipeline')}
              onChange={(id, nextStages) => {
                setPipelineId(id)
                setStages(nextStages)
                if (id && errors.criteria) setErrors(({ criteria, ...rest }) => rest)
              }}
            />
          </div>

          {/* Criteria */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-on-surface flex items-center">
                <Filter className="h-5 w-5 mr-2 text-secondary" />
                {t('emailMarketing.segmentModal.criteria')}
              </h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-on-surface-variant">{t('emailMarketing.segmentModal.match')}</span>
                <select
                  name="logicOperator"
                  value={formData.logicOperator}
                  onChange={handleChange}
                  className="px-3 py-1.5 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent text-sm"
                >
                  <option value="AND">{t('emailMarketing.segmentModal.allConditions')}</option>
                  <option value="OR">{t('emailMarketing.segmentModal.anyCondition')}</option>
                </select>
              </div>
            </div>

            {formData.criteria.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-outline-variant/40 rounded-lg">
                <Filter className="h-12 w-12 text-on-surface-variant/30 mx-auto mb-3" />
                <p className="text-on-surface-variant mb-3">{t('emailMarketing.segmentModal.noConditions')}</p>
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors"
                >
                  {t('emailMarketing.segmentModal.addFirstCondition')}
                </button>
                {errors.criteria && (
                  <p className="mt-2 text-sm text-red-600">{errors.criteria}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {formData.criteria.map((condition, index) => (
                  <div key={index} className="flex items-center space-x-2 p-4 bg-surface-container-high rounded-lg">
                    <select
                      value={condition.field}
                      onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                      className="flex-1 px-3 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent text-sm"
                    >
                      {availableFields.map(field => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(e) => handleUpdateCondition(index, 'operator', e.target.value)}
                      className="flex-1 px-3 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent text-sm"
                    >
                      {operators.map(op => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => handleUpdateCondition(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent text-sm"
                      placeholder={t('emailMarketing.segmentModal.valuePlaceholder')}
                      disabled={condition.operator === 'is_empty' || condition.operator === 'is_not_empty'}
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="w-full px-4 py-2 border-2 border-dashed border-outline-variant/40 rounded-lg hover:border-secondary/50 hover:bg-secondary/15 transition-colors text-on-surface-variant hover:text-secondary flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('emailMarketing.segmentModal.addAnotherCondition')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.segmentModal.tags')}
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.segmentModal.addTagPlaceholder')}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('common.add')}</span>
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-secondary/15 text-secondary rounded-full text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-secondary"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-outline-variant/40 rounded-lg hover:bg-surface-container-high transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-secondary text-on-secondary rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <>
                  <Target className="h-4 w-4" />
                  <span>{segment ? t('emailMarketing.segmentModal.updateSegment') : t('emailMarketing.segmentModal.createSegmentButton')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

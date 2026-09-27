/**
 * Segment Modal Component
 * 
 * Modal for creating and editing customer segments
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Target, Plus, Trash2, Filter } from 'lucide-react'

interface Condition {
  field: string
  operator: string
  value: string
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logicOperator: 'AND',
    criteria: [] as Condition[],
    tags: [] as string[]
  })

  const [newTag, setNewTag] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // These must be real Lead column names — criteria are evaluated against the
  // lead object, so a field that doesn't exist silently matches nothing.
  const availableFields = [
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'status', label: 'Status' },
    { value: 'stage', label: 'Stage' },
    { value: 'pipelineId', label: 'Pipeline' },
    { value: 'pipeline.name', label: 'Pipeline Name' },
    { value: 'value', label: 'Deal Value' },
    { value: 'company', label: 'Company' },
    { value: 'position', label: 'Position' },
    { value: 'source', label: 'Source' },
    { value: 'tags', label: 'Tags' },
    { value: 'createdAt', label: 'Created Date' },
    { value: 'updatedAt', label: 'Updated Date' }
  ]

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' }
  ]

  useEffect(() => {
    if (!isOpen) return
    if (segment) {
      setFormData({
        name: segment.name || '',
        description: segment.description || '',
        logicOperator: segment.logicOperator || 'AND',
        criteria: segment.criteria
          ? (typeof segment.criteria === 'string' ? JSON.parse(segment.criteria) : segment.criteria)
          : [],
        tags: segment.tags
          ? (typeof segment.tags === 'string' ? JSON.parse(segment.tags) : segment.tags)
          : []
      })
    } else {
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
      criteria: [...prev.criteria, { field: 'name', operator: 'equals', value: '' }]
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
      newErrors.name = 'Segment name is required'
    }
    if (formData.criteria.length === 0) {
      newErrors.criteria = 'At least one condition is required'
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
        criteria: JSON.stringify(formData.criteria),
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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {segment ? 'Edit Segment' : 'Create New Segment'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2 text-indigo-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Segment Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., High-Value Leads"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Describe the purpose of this segment..."
                />
              </div>
            </div>
          </div>

          {/* Criteria */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Filter className="h-5 w-5 mr-2 text-indigo-600" />
                Criteria
              </h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Match:</span>
                <select
                  name="logicOperator"
                  value={formData.logicOperator}
                  onChange={handleChange}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                >
                  <option value="AND">All conditions</option>
                  <option value="OR">Any condition</option>
                </select>
              </div>
            </div>

            {formData.criteria.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <Filter className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">No conditions added yet</p>
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Add First Condition
                </button>
                {errors.criteria && (
                  <p className="mt-2 text-sm text-red-600">{errors.criteria}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {formData.criteria.map((condition, index) => (
                  <div key={index} className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                    <select
                      value={condition.field}
                      onChange={(e) => handleUpdateCondition(index, 'field', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
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
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
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
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      placeholder="Value"
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
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-gray-600 hover:text-indigo-600 flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Another Condition</span>
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Target className="h-5 w-5 mr-2 text-indigo-600" />
              Tags
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Add a tag..."
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add</span>
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-indigo-600"
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
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Target className="h-4 w-4" />
                  <span>{segment ? 'Update Segment' : 'Create Segment'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

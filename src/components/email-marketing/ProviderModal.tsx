/**
 * Provider Modal Component
 * 
 * Modal for configuring email service providers
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Key, Mail, CheckCircle2, AlertCircle, Eye, EyeOff, ChevronDown } from 'lucide-react'

interface ProviderModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (provider: any) => void
  provider?: any
  workspaceId: string
}

export default function ProviderModal({
  isOpen,
  onClose,
  onSave,
  provider,
  workspaceId
}: ProviderModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'sendgrid',
    apiKey: '',
    region: '',
    fromEmail: '',
    fromName: '',
    replyTo: '',
    dailyLimit: '',
    monthlyLimit: '',
    isActive: true,
    isDefault: false,
    config: {}
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false)
  const providerTypes = [
    { value: 'sendgrid', label: 'SendGrid', icon: <img src="https://www.vectorlogo.zone/logos/sendgrid/sendgrid-icon.svg" className="w-5 h-5 ml-1" alt="" /> },
    { value: 'ses', label: 'AWS SES', icon: <img src="https://www.vectorlogo.zone/logos/amazon_aws/amazon_aws-icon.svg" className="w-5 h-5 ml-1" alt="" /> },
    { value: 'resend', label: 'Resend', icon: <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/resend.svg" className="w-5 h-5 ml-1 dark:invert" alt="" /> },
    { value: 'mailgun', label: 'Mailgun', icon: <img src="https://www.vectorlogo.zone/logos/mailgun/mailgun-icon.svg" className="w-5 h-5 ml-1" alt="" /> },
    { value: 'postmark', label: 'Postmark', icon: <img src="https://www.vectorlogo.zone/logos/postmarkapp/postmarkapp-icon.svg" className="w-5 h-5 ml-1" alt="" /> },
    { value: 'brevo', label: 'Brevo', icon: <img src="https://cdn.simpleicons.org/brevo/008060" className="w-5 h-5 ml-1" alt="" /> },
    // "Custom SMTP" was offered here but never implemented: it collected no host
    // or port, and every email sent through it was reported sent while nothing
    // was delivered. Re-add it once there is an SMTP sender behind it.
  ]

  // Providers whose bounce/complaint webhook BorsFlow creates on the account itself
  const autoTrackingTypes = ['resend', 'sendgrid', 'mailgun', 'postmark']
  const typeLabel = providerTypes.find(t => t.value === formData.type)?.label || formData.type

  const mailgunRegions = [
    { value: '', label: 'US (default)' },
    { value: 'eu', label: 'EU' }
  ]

  const sesRegions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' }
  ]

  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name || '',
        type: provider.type || 'sendgrid',
        apiKey: provider.apiKey || '',
        region: provider.region || '',
        fromEmail: provider.fromEmail || '',
        fromName: provider.fromName || '',
        replyTo: provider.replyTo || '',
        dailyLimit: provider.dailyLimit?.toString() || '',
        monthlyLimit: provider.monthlyLimit?.toString() || '',
        isActive: provider.isActive ?? true,
        isDefault: provider.isDefault ?? false,
        config: provider.config ? JSON.parse(provider.config) : {}
      })
    }
  }, [provider])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement
    const { name, value, type } = target
    const checked = target.checked
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Provider name is required'
    }
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'API key is required'
    }
    if (!formData.fromEmail.trim()) {
      newErrors.fromEmail = 'From email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.fromEmail)) {
      newErrors.fromEmail = 'Invalid email address'
    }
    if (formData.replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.replyTo)) {
      newErrors.replyTo = 'Invalid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleTest = async () => {
    if (!validateForm()) {
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/email-marketing/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          apiKey: formData.apiKey,
          fromEmail: formData.fromEmail,
          region: formData.region
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setTestResult({ success: true, message: 'Provider configuration test successful!' })
      } else {
        setTestResult({ success: false, message: `Test failed: ${data.error}` })
      }
    } catch (error) {
      console.error('Test failed:', error)
      setTestResult({ success: false, message: 'Provider configuration test failed. Please check your connection.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const providerData = {
        ...formData,
        workspaceId,
        dailyLimit: formData.dailyLimit ? parseInt(formData.dailyLimit) : null,
        monthlyLimit: formData.monthlyLimit ? parseInt(formData.monthlyLimit) : null,
        config: JSON.stringify(formData.config)
      }

      await onSave(providerData)
      onClose()
    } catch (error) {
      console.error('Error saving provider:', error)
      setSaveError(error instanceof Error ? error.message : 'The provider could not be saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {provider ? 'Edit Provider' : 'Add New Provider'}
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
              <Settings className="h-5 w-5 mr-2 text-indigo-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Primary SendGrid Account"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider Type *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-left"
                  >
                    <div className="flex items-center space-x-3">
                      {providerTypes.find(t => t.value === formData.type)?.icon}
                      <span className="text-gray-900">
                        {providerTypes.find(t => t.value === formData.type)?.label}
                      </span>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isTypeDropdownOpen ? 'transform rotate-180' : ''}`} />
                  </button>

                  {isTypeDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {providerTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            // Regions differ per provider (SES "us-east-1", Mailgun "eu"), so don't carry one over
                            setFormData(prev => ({ ...prev, type: type.value, region: prev.type === type.value ? prev.region : '' }));
                            setIsTypeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                            formData.type === type.value ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <div className="flex-shrink-0 w-6 flex justify-center">
                            {type.icon}
                          </div>
                          <span className={`text-sm ${
                            formData.type === type.value ? 'font-semibold text-indigo-600' : 'text-gray-700'
                          }`}>
                            {type.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {formData.type === 'mailgun' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mailgun Region
                  </label>
                  <select
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {mailgunRegions.map(region => (
                      <option key={region.value} value={region.value}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.type === 'ses' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AWS Region
                  </label>
                  <select
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select region</option>
                    {sesRegions.map(region => (
                      <option key={region.value} value={region.value}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Authentication */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Key className="h-5 w-5 mr-2 text-indigo-600" />
              Authentication
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key *
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.apiKey ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your API key"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.apiKey && (
                <p className="mt-1 text-sm text-red-600">{errors.apiKey}</p>
              )}
              {autoTrackingTypes.includes(formData.type) ? (
                <p className="mt-2 text-sm text-gray-500 flex items-start">
                  <CheckCircle2 className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0 text-green-500" />
                  <span>
                    Bounce and complaint tracking is connected to your {typeLabel} account automatically when you save — nothing to set up.
                    {formData.type === 'postmark'
                      ? ' Use your Server API token.'
                      : ' Use an API key with full access.'}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-500 flex items-start">
                  <AlertCircle className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0 text-gray-400" />
                  <span>Bounce and complaint tracking isn&apos;t available for {typeLabel} yet. Sending works normally.</span>
                </p>
              )}
            </div>
          </div>

          {/* Email Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Mail className="h-5 w-5 mr-2 text-indigo-600" />
              Email Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Email *
                </label>
                <input
                  type="email"
                  name="fromEmail"
                  value={formData.fromEmail}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.fromEmail ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., noreply@yourcompany.com"
                />
                {errors.fromEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.fromEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Name
                </label>
                <input
                  type="text"
                  name="fromName"
                  value={formData.fromName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Your Company Name"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reply To
                </label>
                <input
                  type="email"
                  name="replyTo"
                  value={formData.replyTo}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.replyTo ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., support@yourcompany.com"
                />
                {errors.replyTo && (
                  <p className="mt-1 text-sm text-red-600">{errors.replyTo}</p>
                )}
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-indigo-600" />
              Rate Limits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Daily Limit
                </label>
                <input
                  type="number"
                  name="dailyLimit"
                  value={formData.dailyLimit}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., 10000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Limit
                </label>
                <input
                  type="number"
                  name="monthlyLimit"
                  value={formData.monthlyLimit}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., 300000"
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-indigo-600" />
              Options
            </h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Active</span>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Set as default provider</span>
                <AlertCircle className="h-4 w-4 text-blue-500" />
              </label>
            </div>
          </div>

          {saveError && (
            <div className="p-4 rounded-lg flex items-center mb-4 bg-red-50 text-red-800 border border-red-200">
              <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
              {saveError}
            </div>
          )}

          {testResult && (
            <div className={`p-4 rounded-lg flex items-center mb-4 ${
              testResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
              )}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {testing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Test Configuration</span>
                </>
              )}
            </button>
            <div className="flex space-x-3">
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
                    <Settings className="h-4 w-4" />
                    <span>{provider ? 'Update Provider' : 'Add Provider'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

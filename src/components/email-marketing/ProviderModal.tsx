/**
 * Provider Modal Component
 *
 * Modal for configuring email service providers
 */

'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
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
  const { t } = useI18n()
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
  const typeLabel = providerTypes.find(pt => pt.value === formData.type)?.label || formData.type

  const mailgunRegions = [
    { value: '', label: t('emailMarketing.providerModal.regionUsDefault') },
    { value: 'eu', label: t('emailMarketing.providerModal.regionEu') }
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
      newErrors.name = t('emailMarketing.providerModal.nameRequired')
    }
    if (!formData.apiKey.trim()) {
      newErrors.apiKey = t('emailMarketing.providerModal.apiKeyRequired')
    }
    if (!formData.fromEmail.trim()) {
      newErrors.fromEmail = t('emailMarketing.providerModal.fromEmailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.fromEmail)) {
      newErrors.fromEmail = t('emailMarketing.providerModal.invalidEmail')
    }
    if (formData.replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.replyTo)) {
      newErrors.replyTo = t('emailMarketing.providerModal.invalidEmail')
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
        setTestResult({ success: true, message: t('emailMarketing.providerModal.testSuccess') })
      } else {
        setTestResult({ success: false, message: t('emailMarketing.providerModal.testFailed', { error: data.error }) })
      }
    } catch (error) {
      console.error('Test failed:', error)
      setTestResult({ success: false, message: t('emailMarketing.providerModal.testFailedGeneric') })
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
      setSaveError(error instanceof Error ? error.message : t('emailMarketing.providerModal.saveFailedGeneric'))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-container-low border-b border-outline-variant/20 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-secondary" />
            <h2 className="text-xl font-semibold text-on-surface">
              {provider ? t('emailMarketing.providerModal.editTitle') : t('emailMarketing.providerModal.createTitle')}
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
              <Settings className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.providerModal.basicInformation')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.providerModal.providerName')}
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.providerModal.providerNamePlaceholder')}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-error">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.providerModal.providerType')}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-surface-container-lowest border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent text-left"
                  >
                    <div className="flex items-center space-x-3">
                      {providerTypes.find(pt => pt.value === formData.type)?.icon}
                      <span className="text-on-surface">
                        {providerTypes.find(pt => pt.value === formData.type)?.label}
                      </span>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-on-surface-variant transition-transform ${isTypeDropdownOpen ? 'transform rotate-180' : ''}`} />
                  </button>

                  {isTypeDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {providerTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            // Regions differ per provider (SES "us-east-1", Mailgun "eu"), so don't carry one over
                            setFormData(prev => ({ ...prev, type: type.value, region: prev.type === type.value ? prev.region : '' }));
                            setIsTypeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-surface-container-high transition-colors ${
                            formData.type === type.value ? 'bg-secondary/15' : ''
                          }`}
                        >
                          <div className="flex-shrink-0 w-6 flex justify-center">
                            {type.icon}
                          </div>
                          <span className={`text-sm ${
                            formData.type === type.value ? 'font-semibold text-secondary' : 'text-on-surface'
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
                  <label className="block text-sm font-medium text-on-surface mb-1">
                    {t('emailMarketing.providerModal.mailgunRegion')}
                  </label>
                  <select
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
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
                  <label className="block text-sm font-medium text-on-surface mb-1">
                    {t('emailMarketing.providerModal.awsRegion')}
                  </label>
                  <select
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  >
                    <option value="">{t('emailMarketing.providerModal.selectRegion')}</option>
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
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Key className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.providerModal.authentication')}
            </h3>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                {t('emailMarketing.providerModal.apiKey')}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.apiKey ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.providerModal.apiKeyPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.apiKey && (
                <p className="mt-1 text-sm text-error">{errors.apiKey}</p>
              )}
              {autoTrackingTypes.includes(formData.type) ? (
                <p className="mt-2 text-sm text-on-surface-variant flex items-start">
                  <CheckCircle2 className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0 text-green-500 dark:text-green-400" />
                  <span>
                    {t('emailMarketing.providerModal.trackingAutoConnected', { provider: typeLabel })}
                    {' '}
                    {formData.type === 'postmark'
                      ? t('emailMarketing.providerModal.usePostmarkToken')
                      : t('emailMarketing.providerModal.useFullAccessKey')}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-on-surface-variant flex items-start">
                  <AlertCircle className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0 text-on-surface-variant" />
                  <span>{t('emailMarketing.providerModal.trackingNotAvailable', { provider: typeLabel })}</span>
                </p>
              )}
            </div>
          </div>

          {/* Email Settings */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Mail className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.providerModal.emailSettings')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.providerModal.fromEmail')}
                </label>
                <input
                  type="email"
                  name="fromEmail"
                  value={formData.fromEmail}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.fromEmail ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.providerModal.fromEmailPlaceholder')}
                />
                {errors.fromEmail && (
                  <p className="mt-1 text-sm text-error">{errors.fromEmail}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.providerModal.fromName')}
                </label>
                <input
                  type="text"
                  name="fromName"
                  value={formData.fromName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.providerModal.fromNamePlaceholder')}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.providerModal.replyTo')}
                </label>
                <input
                  type="email"
                  name="replyTo"
                  value={formData.replyTo}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent ${
                    errors.replyTo ? 'border-red-500' : 'border-outline-variant/40'
                  }`}
                  placeholder={t('emailMarketing.providerModal.replyToPlaceholder')}
                />
                {errors.replyTo && (
                  <p className="mt-1 text-sm text-error">{errors.replyTo}</p>
                )}
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.providerModal.rateLimits')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.providerModal.dailyLimit')}
                </label>
                <input
                  type="number"
                  name="dailyLimit"
                  value={formData.dailyLimit}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.providerModal.dailyLimitPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">
                  {t('emailMarketing.providerModal.monthlyLimit')}
                </label>
                <input
                  type="number"
                  name="monthlyLimit"
                  value={formData.monthlyLimit}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-secondary/50 focus:border-transparent"
                  placeholder={t('emailMarketing.providerModal.monthlyLimitPlaceholder')}
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="text-lg font-medium text-on-surface mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-secondary" />
              {t('emailMarketing.providerModal.options')}
            </h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="w-4 h-4 text-secondary border-outline-variant/40 rounded focus:ring-secondary/50"
                />
                <span className="text-sm text-on-surface">{t('emailMarketing.providerModal.activeOption')}</span>
                <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleChange}
                  className="w-4 h-4 text-secondary border-outline-variant/40 rounded focus:ring-secondary/50"
                />
                <span className="text-sm text-on-surface">{t('emailMarketing.providerModal.setAsDefault')}</span>
                <AlertCircle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              </label>
            </div>
          </div>

          {saveError && (
            <div className="p-4 rounded-lg flex items-center mb-4 bg-error-container/10 text-error border border-error/20">
              <AlertCircle className="h-5 w-5 mr-2 text-error" />
              {saveError}
            </div>
          )}

          {testResult && (
            <div className={`p-4 rounded-lg flex items-center mb-4 ${
              testResult.success
                ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/40'
                : 'bg-error-container/10 text-error border border-error/20'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-500 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2 text-error" />
              )}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-6 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-6 py-2 border border-outline-variant/40 rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {testing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-surface-variant"></div>
                  <span>{t('emailMarketing.providerModal.testing')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t('emailMarketing.providerModal.testConfiguration')}</span>
                </>
              )}
            </button>
            <div className="flex space-x-3">
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-secondary"></div>
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    <span>{provider ? t('emailMarketing.providerModal.updateProvider') : t('emailMarketing.providerModal.addProvider')}</span>
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

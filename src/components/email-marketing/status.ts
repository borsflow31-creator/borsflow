/**
 * Status labels shared by the campaigns and automations tabs. A status is stored
 * in English and shown in the reader's language; an unknown one is shown as it
 * is rather than as a blank.
 */

import { type MessageKey } from '@/i18n/I18nProvider'

export type TFunction = (key: MessageKey, values?: Record<string, string | number>) => string

const STATUS_KEYS: Record<string, MessageKey> = {
  draft: 'emailMarketing.statusLabels.draft',
  scheduled: 'emailMarketing.statusLabels.scheduled',
  sending: 'emailMarketing.statusLabels.sending',
  sent: 'emailMarketing.statusLabels.sent',
  paused: 'emailMarketing.statusLabels.paused',
  cancelled: 'emailMarketing.statusLabels.cancelled',
  active: 'emailMarketing.statusLabels.active',
}

/** Translated label for a campaign/automation status, falling back to the raw value */
export function statusLabel(status: string, t: TFunction): string {
  const key = STATUS_KEYS[status]
  return key ? t(key) : status
}

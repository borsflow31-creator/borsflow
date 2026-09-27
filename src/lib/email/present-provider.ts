import { maskStoredApiKey } from './provider-keys'

/**
 * A provider as the API returns it: the key only as a masked tail, and never the
 * webhook secret BorsFlow keeps to verify the client's events.
 */
export function presentProvider<T extends { apiKey?: string | null }>(provider: T) {
  return {
    ...provider,
    apiKey: maskStoredApiKey(provider.apiKey),
    apiKeyEncrypted: undefined,
    webhookSecret: undefined,
    webhookId: undefined,
  }
}

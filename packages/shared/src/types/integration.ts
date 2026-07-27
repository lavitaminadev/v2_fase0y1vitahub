/**
 * @fileoverview External integration domain types.
 */

/**
 * Supported third-party providers.
 */
export type IntegrationProvider =
  | 'google_drive'
  | 'whatsapp'
  | 'slack'
  | 'trello'
  | 'notion'
  | 'meta'
  | 'hubspot'
  | 'shopify'
  | 'windsor'
  | 'custom'

/**
 * Connection status of an integration.
 */
export type IntegrationStatus = 'pending' | 'connected' | 'disconnected' | 'error'

/**
 * Integration response returned by integration endpoints.
 */
export interface IntegrationResponse {
  id: string
  organizationId: string
  provider: IntegrationProvider
  status: IntegrationStatus
  config?: Record<string, unknown>
  lastSyncAt?: Date
  createdAt: Date
}

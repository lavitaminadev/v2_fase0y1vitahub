/**
 * @fileoverview Client domain types.
 */

/**
 * Lifecycle status of a client.
 */
export type ClientStatus = 'onboarding' | 'active' | 'paused' | 'at_risk' | 'churned'

/**
 * Client response returned by client management endpoints.
 */
export interface ClientResponse {
  id: string
  organizationId: string
  name: string
  legalName?: string
  industry?: string
  status: ClientStatus
  retainerAmount?: number
  currency: string
  startedAt?: Date
  renewalAt?: Date
  whatsappGroup?: string
  driveFolderId?: string
  defaultUdBudget: number
  createdAt: Date
}

/**
 * Payload to create a new client.
 */
export interface CreateClientRequest {
  name: string
  legalName?: string
  industry?: string
  status?: ClientStatus
  retainerAmount?: number
  leadId?: string
  communityManagerId?: string
}

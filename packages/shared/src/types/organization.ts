/**
 * @fileoverview Organization and settings domain types.
 */

/**
 * Organization-level configuration.
 */
export interface OrganizationSettings {
  timezone?: string
  currency?: string
  weekStartDay?: 'monday' | 'sunday'
  approvalFlow?: 'sequential' | 'parallel'
  retentionPolicyDays?: number
}

/**
 * Organization response returned by organization endpoints.
 */
export interface OrganizationResponse {
  id: string
  name: string
  code: string
  logoUrl?: string
  timezone: string
  isActive: boolean
  settings?: OrganizationSettings
  createdAt: Date
}

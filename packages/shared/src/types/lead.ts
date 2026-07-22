/**
 * @fileoverview Lead domain types.
 */

/**
 * Lead funnel status.
 */
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'meeting_scheduled'
  | 'quote_sent'
  | 'negotiation'
  | 'won'
  | 'lost'

export type LeadFitStatus =
  | 'qualified'
  | 'review'
  | 'discarded'

/**
 * Lead response returned by CRM endpoints.
 */
export interface LeadResponse {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  source?: string
  sourceDetail?: string
  externalLeadId?: string
  externalFormId?: string
  externalCampaignId?: string
  campaignName?: string
  pageId?: string
  status: LeadStatus
  fitStatus: LeadFitStatus
  qualityScore: number
  discardReason?: string
  assignedTo?: string
  notes?: string
  consentCapturedAt?: Date
  retentionReviewAt?: Date
  metadata?: Record<string, unknown>
  convertedAt?: Date
  convertedToClientId?: string
  createdAt: Date
}

/**
 * Payload to create a new lead.
 */
export interface CreateLeadRequest {
  name: string
  email?: string
  phone?: string
  company?: string
  source?: string
}

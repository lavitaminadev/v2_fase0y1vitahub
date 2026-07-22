/**
 * @fileoverview Approval workflow domain types.
 */

/**
 * Status of an approval request.
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

/**
 * Kind of entity that can go through an approval flow.
 */
export type ApprovalEntityType = 'piece' | 'content_grid' | 'budget' | 'invoice'

/**
 * Approval request response.
 */
export interface ApprovalResponse {
  id: string
  entityType: ApprovalEntityType
  entityId: string
  requestedBy: string
  approvedBy?: string
  status: ApprovalStatus
  comment?: string
  requestedAt: Date
  decidedAt?: Date
}

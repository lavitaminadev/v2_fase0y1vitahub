/**
 * @fileoverview Billing / invoice domain types.
 */

/**
 * Payment status of an invoice.
 */
export type BillingStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded'

/**
 * Billing recurrence period.
 */
export type BillingPeriod = 'monthly' | 'quarterly' | 'biannual' | 'annual'

/**
 * Invoice response returned by billing endpoints.
 */
export interface BillingResponse {
  id: string
  clientId: string
  invoiceNumber: string
  amount: number
  currency: string
  status: BillingStatus
  period: BillingPeriod
  issuedAt: Date
  dueAt: Date
  paidAt?: Date
  notes?: string
  createdAt: Date
}

/**
 * @fileoverview Design-budget / UD (Unidades de Diseño) domain types.
 */

/**
 * Types of movements recorded against a UD budget.
 */
export type UdMovementType =
  | 'budget_assigned'
  | 'reservation'
  | 'consumption'
  | 'adjustment'
  | 'extra'
  | 'rollover'

/**
 * Status of a monthly UD budget.
 */
export type UdBudgetStatus = 'active' | 'closed' | 'exceeded'

/**
 * Monthly UD budget response.
 */
export interface UdBudgetResponse {
  id: string
  clientId: string
  year: number
  month: number
  contracted: number
  reserved: number
  consumed: number
  status: UdBudgetStatus
  createdAt: Date
}

/**
 * Single movement recorded against a UD budget.
 */
export interface UdMovementResponse {
  id: string
  udBudgetId: string
  pieceId?: string
  type: UdMovementType
  amount: number
  reason: string
  actorId?: string
  createdAt: Date
}

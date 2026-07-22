/**
 * @fileoverview Gamification / XP domain types.
 */

/**
 * XP tier achieved by a team member based on accumulated points.
 */
export type XpTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

/**
 * Business events that can grant XP to a user.
 */
export type XpEventType =
  | 'piece_delivered'
  | 'piece_approved'
  | 'correction_resolved'
  | 'streak_bonus'
  | 'quality_bonus'
  | 'client_praise'
  | 'overtime'
  | 'mentorship'
  | 'training_completed'
  | 'internal_recognition'

/**
 * Status of a weekly XP period.
 */
export type XpPeriodStatus = 'open' | 'closed'

/**
 * Weekly XP aggregation for a user.
 */
export interface XpPeriodResponse {
  id: string
  userId: string
  weekStart: Date
  totalXp: number
  tier: XpTier
  status: XpPeriodStatus
}

/**
 * Individual XP event that contributed to a period.
 */
export interface XpEventResponse {
  id: string
  xpPeriodId: string
  pieceId?: string
  type: XpEventType
  points: number
  description?: string
  createdAt: Date
}

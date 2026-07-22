/**
 * @fileoverview Runtime arrays derived from the shared domain unions.
 *
 * These arrays are kept in sync with the union types via the `satisfies` operator.
 * Consumers can use them for select options, validation, or UI labels without
 * duplicating the list of allowed values.
 */

import type { ClientStatus } from '../types/client'
import type { LeadStatus } from '../types/lead'
import type { PieceStatus, PieceType } from '../types/production'
import type { UdMovementType, UdBudgetStatus } from '../types/design-budget'
import type { XpTier, XpEventType, XpPeriodStatus } from '../types/gamification'
import type { MeetingType, MeetingStatus } from '../types/meeting'
import type { ContentGridStatus, ContentItemStatus, ContentItemType } from '../types/content'
import type { NotificationType } from '../types/notification'
import type { BillingStatus, BillingPeriod } from '../types/billing'
import type { ApprovalStatus, ApprovalEntityType } from '../types/approval'
import type { IntegrationProvider, IntegrationStatus } from '../types/integration'
import type { UserWorkMode, UserRole } from '../types/user'

/** All allowed client lifecycle statuses. */
export const ClientStatuses = ['onboarding', 'active', 'paused', 'at_risk', 'churned'] as const satisfies readonly ClientStatus[]

/** All allowed lead funnel statuses. */
export const LeadStatuses = ['new', 'contacted', 'meeting_scheduled', 'quote_sent', 'negotiation', 'won', 'lost'] as const satisfies readonly LeadStatus[]

/** All allowed piece statuses. */
export const PieceStatuses = ['backlog', 'assigned', 'in_progress', 'internal_review', 'client_validation', 'correction', 'approved', 'delivered'] as const satisfies readonly PieceStatus[]

/** All allowed piece types. */
export const PieceTypes = ['post_simple', 'post_author', 'carousel', 'story_original', 'story_adapted', 'story_template', 'reel_cover', 'flyer_digital', 'flyer_print'] as const satisfies readonly PieceType[]

/** All allowed UD movement types. */
export const UdMovementTypes = ['budget_assigned', 'reservation', 'consumption', 'adjustment', 'extra', 'rollover'] as const satisfies readonly UdMovementType[]

/** All allowed UD budget statuses. */
export const UdBudgetStatuses = ['active', 'closed', 'exceeded'] as const satisfies readonly UdBudgetStatus[]

/** All allowed XP tiers. */
export const XpTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const satisfies readonly XpTier[]

/** All allowed XP event types. */
export const XpEventTypes = ['piece_delivered', 'piece_approved', 'correction_resolved', 'streak_bonus', 'quality_bonus', 'client_praise', 'overtime', 'mentorship', 'training_completed', 'internal_recognition'] as const satisfies readonly XpEventType[]

/** All allowed XP period statuses. */
export const XpPeriodStatuses = ['open', 'closed'] as const satisfies readonly XpPeriodStatus[]

/** All allowed meeting types. */
export const MeetingTypes = ['strategic', 'weekly'] as const satisfies readonly MeetingType[]

/** All allowed meeting statuses. */
export const MeetingStatuses = ['scheduled', 'completed', 'cancelled', 'rescheduled'] as const satisfies readonly MeetingStatus[]

/** All allowed content grid statuses. */
export const ContentGridStatuses = ['draft', 'submitted', 'approved', 'rejected', 'published'] as const satisfies readonly ContentGridStatus[]

/** All allowed content item statuses. */
export const ContentItemStatuses = ['pending', 'in_production', 'completed'] as const satisfies readonly ContentItemStatus[]

/** All allowed content item types. */
export const ContentItemTypes = ['post', 'carousel', 'story', 'reel', 'flyer', 'video', 'other'] as const satisfies readonly ContentItemType[]

/** All allowed notification types. */
export const NotificationTypes = ['piece_assigned', 'piece_status', 'correction_requested', 'meeting_reminder', 'budget_alert', 'deadline_approaching', 'system'] as const satisfies readonly NotificationType[]

/** All allowed invoice statuses. */
export const BillingStatuses = ['pending', 'paid', 'overdue', 'cancelled', 'refunded'] as const satisfies readonly BillingStatus[]

/** All allowed billing periods. */
export const BillingPeriods = ['monthly', 'quarterly', 'biannual', 'annual'] as const satisfies readonly BillingPeriod[]

/** All allowed approval statuses. */
export const ApprovalStatuses = ['pending', 'approved', 'rejected', 'cancelled'] as const satisfies readonly ApprovalStatus[]

/** All allowed approval entity types. */
export const ApprovalEntityTypes = ['piece', 'content_grid', 'budget', 'invoice'] as const satisfies readonly ApprovalEntityType[]

/** All allowed integration providers. */
export const IntegrationProviders = ['google_drive', 'whatsapp', 'slack', 'trello', 'notion', 'meta', 'hubspot', 'shopify', 'windsor', 'custom'] as const satisfies readonly IntegrationProvider[]

/** All allowed integration statuses. */
export const IntegrationStatuses = ['pending', 'connected', 'disconnected', 'error'] as const satisfies readonly IntegrationStatus[]

/** All allowed user work modes. */
export const UserWorkModes = ['presential', 'hybrid', 'remote'] as const satisfies readonly UserWorkMode[]

/** All allowed user roles. */
export const UserRoles = ['admin', 'commercial_director', 'creative_director', 'operations_director', 'art_director', 'av_director', 'ai_lead', 'community_manager', 'designer', 'audiovisual', 'client'] as const satisfies readonly UserRole[]

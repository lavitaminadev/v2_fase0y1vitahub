/**
 * @fileoverview Meeting domain types.
 */

/**
 * Type of meeting scheduled with a client.
 */
export type MeetingType = 'strategic' | 'weekly'

/**
 * Lifecycle status of a meeting.
 */
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'

/**
 * Meeting response returned by meeting endpoints.
 */
export interface MeetingResponse {
  id: string
  clientId: string
  title: string
  type: MeetingType
  status: MeetingStatus
  date: Date
  durationMinutes?: number
  notes?: string
  createdBy: string
  createdAt: Date
}

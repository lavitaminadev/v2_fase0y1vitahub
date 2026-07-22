/**
 * @fileoverview Content calendar / grid domain types.
 */

/**
 * Status of a weekly content grid.
 */
export type ContentGridStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'published'

/**
 * Status of a single item inside a content grid.
 */
export type ContentItemStatus = 'pending' | 'in_production' | 'completed'

/**
 * Type of a content item.
 */
export type ContentItemType =
  | 'post'
  | 'carousel'
  | 'story'
  | 'reel'
  | 'flyer'
  | 'video'
  | 'other'

/**
 * Weekly content grid response.
 */
export interface ContentGridResponse {
  id: string
  clientId: string
  title: string
  weekStart: Date
  weekEnd: Date
  status: ContentGridStatus
  createdAt: Date
}

/**
 * Content item response.
 */
export interface ContentItemResponse {
  id: string
  contentGridId: string
  type: ContentItemType
  status: ContentItemStatus
  caption?: string
  dueDate?: Date
  pieceId?: string
  createdAt: Date
}

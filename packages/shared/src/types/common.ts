/**
 * @fileoverview Common API contracts shared across the VITAHUB monorepo.
 *
 * These types define the generic response envelopes and pagination shape used by
 * both the NestJS backend and the React frontend. Keeping them in `@vitahub/shared`
 * guarantees that both sides of the network boundary agree on the wire format.
 */

/**
 * Generic paginated list returned by collection endpoints.
 *
 * @template T - Type of the items returned in the current page.
 */
export interface PaginatedResponse<T> {
  /** Items for the current page. */
  data: T[]
  /** Total items across all pages. */
  total: number
  /** 1-based page number. */
  page: number
  /** Items per page. */
  limit: number
}

/**
 * Standard envelope returned by API endpoints.
 *
 * @template T - Type of the payload when the request succeeds.
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request was processed successfully. */
  success: boolean
  /** Payload when `success` is true. */
  data?: T
  /** Human-readable message, usually used for errors or confirmations. */
  message?: string
  /** Field-level validation errors when `success` is false. */
  errors?: ApiError[]
}

/**
 * A single validation error attached to a request field.
 */
export interface ApiError {
  /** Field that failed validation. */
  field?: string
  /** Validation message. */
  message: string
}

/**
 * A closed date range. Both endpoints are inclusive.
 */
export interface DateRange {
  /** Start date of the range. */
  start: Date
  /** End date of the range. */
  end: Date
}

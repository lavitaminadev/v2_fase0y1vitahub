/**
 * @fileoverview Domain constants shared across the VITAHUB monorepo.
 */

/** API version prefix used by backend routes. */
export const API_VERSION = 'v1'

/** Default 1-based page for paginated requests. */
export const PAGINATION_DEFAULT_PAGE = 1

/** Default page size for paginated requests. */
export const PAGINATION_DEFAULT_LIMIT = 20

/** Maximum page size allowed for paginated requests. */
export const PAGINATION_MAX_LIMIT = 100

/** Default UD budget assigned to a new client. */
export const UD_BUDGET_DEFAULT = 20

/** Minimum difficulty level for a piece. */
export const DIFFICULTY_MIN = 1

/** Maximum difficulty level for a piece. */
export const DIFFICULTY_MAX = 5

/** JWT access token expiry expression. */
export const TOKEN_EXPIRATION_ACCESS = '15m'

/** JWT refresh token expiry expression. */
export const TOKEN_EXPIRATION_REFRESH = '7d'

/** Multiplier applied to streak bonus XP. */
export const XP_STREAK_BONUS_MULTIPLIER = 1.5

/** Shortest allowed meeting duration in minutes. */
export const MEETING_MIN_DURATION_MINUTES = 15

/** Longest allowed meeting duration in minutes. */
export const MEETING_MAX_DURATION_MINUTES = 180

/** Maximum allowed file upload size in bytes (50 MB). */
export const FILE_MAX_SIZE_BYTES = 50 * 1024 * 1024

/** MIME types accepted for file uploads. */
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'] as const

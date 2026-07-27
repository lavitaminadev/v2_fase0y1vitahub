/**
 * @fileoverview Authentication request/response contracts.
 */

import type { UserDto } from './user'

/**
 * Credentials sent to `/auth/login`.
 */
export interface LoginRequest {
  /** Registered email address. */
  email: string
  /** Plain-text password (transmitted over HTTPS). */
  password: string
}

/**
 * Payload sent to `/auth/register`.
 */
export interface RegisterRequest {
  /** New user's email. */
  email: string
  /** Plain-text password. */
  password: string
  /** Display name. */
  name: string
  /** Optional existing organization id; otherwise a new org is created. */
  organizationId?: string
}

/**
 * Successful authentication response.
 *
 * Both the access and refresh tokens are short-lived secrets returned by the
 * backend. Callers should store them securely and never log them.
 */
export interface AuthResponse {
  /** JWT access token used for authenticated requests. */
  accessToken: string
  /** JWT refresh token used to obtain a new access token. */
  refreshToken: string
  /** Authenticated user summary. */
  user: UserDto
}

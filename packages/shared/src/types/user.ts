/**
 * @fileoverview User domain types and role union.
 */

/**
 * Work modality assigned to a user.
 */
export type UserWorkMode = 'presential' | 'hybrid' | 'remote'

/**
 * Available roles in the platform. The role drives navigation visibility,
 * route guards, and authorization decisions.
 */
export type UserRole =
  | 'admin'
  | 'commercial_director'
  | 'creative_director'
  | 'operations_director'
  | 'art_director'
  | 'av_director'
  | 'ai_lead'
  | 'community_manager'
  | 'designer'
  | 'audiovisual'
  | 'client'

/**
 * Minimal user representation returned by auth endpoints.
 */
export interface UserDto {
  /** Unique identifier. */
  id: string
  /** Primary email used for login. */
  email: string
  /** Display name. */
  name: string
  /** Role that defines permissions in the organization. */
  role: UserRole
  /** Organization the user belongs to. */
  organizationId: string
  /** Optional linked client id when the user is a client portal member. */
  clientId?: string
  /** Forces a secure password change after an administrator reset. */
  mustChangePassword?: boolean
}

/**
 * Full user representation used in management endpoints.
 */
export interface UserResponse {
  id: string
  email: string
  name: string
  role: UserRole
  organizationId: string
  phone?: string
  avatarUrl?: string
  workMode?: UserWorkMode
  isActive: boolean
  createdAt: Date
}

/**
 * Payload to create a new user inside an organization.
 */
export interface CreateUserRequest {
  email: string
  password: string
  name: string
  role?: UserRole
  phone?: string
  clientId?: string
  mustChangePassword?: boolean
}

/**
 * Payload to update an existing user.
 */
export interface UpdateUserRequest {
  name?: string
  email?: string
  role?: UserRole
  phone?: string
  clientId?: string
  isActive?: boolean
}

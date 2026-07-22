/**
 * @fileoverview Authentication state management (Zustand).
 *
 * The store keeps the authenticated user and access token in sync with the
 * typed API client. On bootstrap it restores the session through the secure
 * refresh cookie and then loads `/auth/me`.
 */

import { create } from 'zustand';
import type { AuthResponse, UserRole } from '@vitahub/shared';
import { api, setApiToken } from './api';

type BrowserAuthResponse = Pick<AuthResponse, 'accessToken' | 'user'>;

/**
 * Authenticated user profile exposed to the UI.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  organizationId?: string;
  clientId?: string;
  mustChangePassword?: boolean;
}

/**
 * Payload required to register a new account.
 */
export interface RegisterData {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
}

/**
 * Authentication store state and actions.
 */
export interface AuthState {
  /** Currently authenticated user or null. */
  user: User | null;
  /** Raw JWT access token or null. */
  token: string | null;
  /** True while the initial token validation is in progress. */
  loading: boolean;
  /** Last authentication error message. */
  error: string | null;

  /** Log in with email/password. */
  login: (email: string, password: string) => Promise<void>;
  /** Register a new account. */
  register: (data: RegisterData) => Promise<void>;
  /** Revoke the server session and clear local state. */
  logout: () => Promise<void>;
  /** Restore session from the HttpOnly refresh cookie. */
  checkAuth: () => Promise<void>;
  /** Reload the current profile without rotating the browser session. */
  refreshProfile: () => Promise<void>;
  /** Clear transient error state. */
  clearError: () => void;
}

/**
 * Zustand store that manages authentication lifecycle.
 */
export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  error: null,

  login: async (email: string, password: string): Promise<void> => {
    set({ error: null });
    const res = await api.post<BrowserAuthResponse>('/auth/login', { email, password });
    setApiToken(res.accessToken);
    set({ user: res.user as User, token: res.accessToken });
  },

  register: async (data: RegisterData): Promise<void> => {
    set({ error: null });
    const res = await api.post<BrowserAuthResponse>('/auth/register', data);
    setApiToken(res.accessToken);
    set({ user: res.user as User, token: res.accessToken });
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Local cleanup still proceeds if the session was already expired.
    }
    setApiToken(null);
    set({ user: null, token: null });
  },

  checkAuth: async (): Promise<void> => {
    try {
      const session = await api.post<{ accessToken: string }>('/auth/refresh', {});
      setApiToken(session.accessToken);
      const user = await api.get<User>('/auth/me');
      set({ user, token: session.accessToken, loading: false });
    } catch {
      setApiToken(null);
      set({ user: null, token: null, loading: false });
    }
  },

  refreshProfile: async (): Promise<void> => {
    const user = await api.get<User>('/auth/me');
    set({ user });
  },

  clearError: (): void => set({ error: null }),
}));

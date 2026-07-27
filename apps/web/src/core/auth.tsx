/**
 * @fileoverview Gestión del estado de autenticación (Zustand).
 *
 * El store mantiene el usuario autenticado y el access token sincronizados
 * con el cliente de API tipado. Al arrancar, restaura la sesión a través de
 * la cookie segura de refresh y luego carga `/auth/me`.
 */

import { create } from 'zustand';
import type { AuthResponse, UserRole } from '@vitahub/shared';
import { api, setApiToken } from './api';

type BrowserAuthResponse = Pick<AuthResponse, 'accessToken' | 'user'>;

/**
 * Perfil del usuario autenticado expuesto a la UI.
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
  /**
   * Módulos habilitados en la organización, tal como los resuelve el backend.
   *
   * El menú se construye a partir de esta respuesta y no de una lista propia del frontend,
   * de modo que lo visible coincida con lo que el backend autoriza.
   */
  features?: Record<string, boolean>;
  /**
   * Nivel de acceso efectivo por módulo: combina el módulo habilitado, el nivel del cargo
   * y las excepciones definidas para esta persona.
   */
  permissions?: Record<string, PermissionLevel>;
}

/** Niveles de acceso a un módulo, de menor a mayor. Espejo de `permission-level.ts`. */
export type PermissionLevel = 'none' | 'view' | 'edit' | 'manage';

/**
 * Payload requerido para registrar una nueva cuenta.
 */
export interface RegisterData {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
}

/**
 * Estado y acciones del store de autenticación.
 */
export interface AuthState {
  /** Usuario autenticado actualmente, o null. */
  user: User | null;
  /** Access token JWT crudo, o null. */
  token: string | null;
  /** True mientras la validación inicial del token está en progreso. */
  loading: boolean;
  /** Último mensaje de error de autenticación. */
  error: string | null;

  /** Inicia sesión con email/contraseña. */
  login: (email: string, password: string) => Promise<void>;
  /** Registra una nueva cuenta. */
  register: (data: RegisterData) => Promise<void>;
  /** Revoca la sesión en el servidor y limpia el estado local. */
  logout: () => Promise<void>;
  /** Restaura la sesión desde la cookie HttpOnly de refresh. */
  checkAuth: () => Promise<void>;
  /** Recarga el perfil actual sin rotar la sesión del navegador. */
  refreshProfile: () => Promise<void>;
  /** Limpia el estado de error transitorio. */
  clearError: () => void;
}

/**
 * Carga el perfil junto a los permisos efectivos por módulo.
 *
 * Se piden en paralelo y el fallo de los permisos no invalida la sesión: sin ellos la
 * navegación cae al filtrado por rol, que es más permisivo pero mantiene la aplicación
 * utilizable mientras el backend responde de nuevo.
 */
async function loadProfile(): Promise<User> {
  const [user, permissions] = await Promise.all([
    api.get<User>('/auth/me'),
    api.get<{ permissions: Record<string, PermissionLevel> }>('/me/permissions')
      .then((response) => response.permissions)
      .catch(() => undefined),
  ]);
  return { ...user, permissions };
}

/**
 * Store de Zustand que gestiona el ciclo de vida de la autenticación.
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
      // La limpieza local igual procede si la sesión ya estaba expirada.
    }
    setApiToken(null);
    set({ user: null, token: null });
  },

  checkAuth: async (): Promise<void> => {
    try {
      const session = await api.post<{ accessToken: string }>('/auth/refresh', {});
      setApiToken(session.accessToken);
      const user = await loadProfile();
      set({ user, token: session.accessToken, loading: false });
    } catch {
      setApiToken(null);
      set({ user: null, token: null, loading: false });
    }
  },

  refreshProfile: async (): Promise<void> => {
    set({ user: await loadProfile() });
  },

  clearError: (): void => set({ error: null }),
}));

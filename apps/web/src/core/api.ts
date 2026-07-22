/**
 * @fileoverview Typed Axios client used by the React frontend.
 *
 * The client attaches the bearer token to every request and centralizes
 * global error handling and transparent session renewal. Access tokens remain
 * in memory; the backend owns the rotating HttpOnly refresh cookie.
 */

import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

/** Environment-driven base URL for the VITAHUB API. */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Shape of error payloads returned by the NestJS backend.
 * The backend uses `{ success: false, message?: string, errors?: [...] }`.
 */
interface ApiErrorPayload {
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
}

export const API_ERROR_EVENT = 'vitahub:api-error';

export interface ApiErrorEventDetail {
  title: string;
  message: string;
  kind: 'connection' | 'rate_limit' | 'permission' | 'server' | 'validation';
  status?: number;
}

/**
 * Global axios instance configured with the API base URL, JSON headers,
 * and a defensive request timeout.
 */
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/** In-memory access token; persistence is delegated to the HttpOnly cookie. */
let token: string | null = null;
let refreshPromise: Promise<string> | null = null;

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _sessionRetry?: boolean;
}

/**
 * @param t - JWT access token or `null` to clear the session.
 */
export function setApiToken(t: string | null): void {
  token = t;
}

/**
 * Returns the current in-memory token.
 */
export function getApiToken(): string | null {
  return token;
}

// Attach bearer token to every outgoing request.
apiClient.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

/**
 * Extracts a human-readable message from an axios error.
 *
 * @param error - Axios error caught from a failed request.
 * @returns Localized error message.
 */
function extractErrorMessage(error: AxiosError<ApiErrorPayload>): string {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') return 'El servidor está tardando más de lo esperado. Intenta nuevamente en unos segundos.';
    return 'No pudimos conectar con VITAHUB. Revisa la conexión y confirma que el servicio local esté iniciado.';
  }
  if (error.response.status === 429) return 'Se realizaron muchas solicitudes seguidas. Espera unos segundos antes de volver a intentar.';
  if (error.response.status >= 500) return 'El servidor encontró un problema y la acción no se completó. Tus datos no se guardaron parcialmente.';
  const data = error.response?.data;
  if (data?.errors?.length) {
    return data.errors.slice(0, 3).map((item) => item.message).join('. ');
  }
  return data?.message || error.message || 'Error de servidor';
}

function describeApiError(error: AxiosError<ApiErrorPayload>, message: string): ApiErrorEventDetail {
  const status = error.response?.status;
  if (!error.response) return { title: 'Sin conexión con el sistema', message, kind: 'connection' };
  if (status === 429) return { title: 'Pausa necesaria', message, kind: 'rate_limit', status };
  if (status === 403) return { title: 'Acceso no autorizado', message, kind: 'permission', status };
  if (status && status >= 500) return { title: 'Problema del servidor', message, kind: 'server', status };
  return { title: 'Revisa la información', message, kind: 'validation', status };
}

async function renewAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<{ accessToken: string }>('/auth/refresh', {})
      .then((response) => {
        setApiToken(response.data.accessToken);
        return response.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Renew an expired access token once, then centralize terminal 401 handling.
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorPayload>) => {
    const config = error.config as RetryableRequestConfig | undefined;
    const path = config?.url ?? '';
    const isRefreshRequest = path.endsWith('/auth/refresh');
    const isLoginRequest = path.endsWith('/auth/login') || path.endsWith('/auth/register');

    if (error.response?.status === 401 && config && !config._sessionRetry && !isRefreshRequest && !isLoginRequest) {
      config._sessionRetry = true;
      try {
        const accessToken = await renewAccessToken();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient.request(config);
      } catch {
        setApiToken(null);
        window.location.href = '/login';
      }
    }

    if (error.response?.status === 401 && !isRefreshRequest && !isLoginRequest) {
      setApiToken(null);
      window.location.href = '/login';
    }
    const message = extractErrorMessage(error);
    if (error.response?.status !== 401 && !isLoginRequest && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<ApiErrorEventDetail>(API_ERROR_EVENT, {
        detail: describeApiError(error, message),
      }));
    }
    return Promise.reject(new Error(message));
  },
);

/**
 * Type-safe HTTP helpers built on top of `apiClient`.
 *
 * @template T - Expected response body type.
 * @template B - Request body type for POST/PUT.
 */
export const api = {
  /**
   * Performs a GET request.
   *
   * @param path - Relative API path.
   * @param config - Optional axios request config.
   */
  get<T = unknown>(path: string, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.get<T>(path, config).then((r) => r.data);
  },

  /**
   * Performs a POST request.
   *
   * @param path - Relative API path.
   * @param body - Request payload.
   */
  post<T = unknown, B = unknown>(path: string, body?: B): Promise<T> {
    return apiClient.post<T>(path, body).then((r) => r.data);
  },

  /** Uploads one file using the secure multipart endpoint. */
  upload<T = unknown>(path: string, file: File): Promise<T> {
    const body = new FormData();
    body.append('file', file);
    return apiClient.post<T>(path, body).then((r) => r.data);
  },

  /**
   * Performs a PUT request.
   *
   * @param path - Relative API path.
   * @param body - Request payload.
   */
  put<T = unknown, B = unknown>(path: string, body?: B): Promise<T> {
    return apiClient.put<T>(path, body).then((r) => r.data);
  },

  /**
   * Performs a PATCH request.
   *
   * @param path - Relative API path.
   * @param body - Request payload.
   */
  patch<T = unknown, B = unknown>(path: string, body?: B): Promise<T> {
    return apiClient.patch<T>(path, body).then((r) => r.data);
  },

  /**
   * Performs a DELETE request.
   *
   * @param path - Relative API path.
   */
  delete<T = unknown>(path: string): Promise<T> {
    return apiClient.delete<T>(path).then((r) => r.data);
  },
};

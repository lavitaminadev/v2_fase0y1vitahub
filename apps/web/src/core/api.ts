/**
 * @fileoverview Cliente Axios tipado usado por el frontend React.
 *
 * El cliente adjunta el token bearer a cada request y centraliza el manejo
 * global de errores y la renovación transparente de la sesión. Los access
 * tokens viven solo en memoria; el backend es dueño de la cookie HttpOnly
 * rotatoria de refresh.
 */

import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

/** URL base de la API de VITAHUB, definida por variable de entorno. */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** Timeout por defecto de cada request, en milisegundos. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Forma de los payloads de error que devuelve el backend NestJS.
 * El backend usa `{ success: false, message?: string, errors?: [...] }`.
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
 * Instancia global de axios configurada con la URL base de la API,
 * headers JSON y un timeout defensivo de request.
 */
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/** Access token en memoria; la persistencia queda delegada a la cookie HttpOnly. */
let token: string | null = null;
let refreshPromise: Promise<string> | null = null;
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _sessionRetry?: boolean;
}

/**
 * Lee el claim `exp` de un JWT sin verificarlo — esto es puramente para
 * programar la renovación proactiva en el cliente, nunca se usa para nada
 * sensible en materia de seguridad; el servidor vuelve a verificar en cada llamada.
 */
function decodeJwtExpiryMs(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Programa una renovación silenciosa poco antes de que expire el access
 * token, para que la sesión se renueve en segundo plano en vez de esperar a
 * que un request falle con 401. Los access tokens son de vida corta (15m por
 * defecto) justamente para que un token robado tenga una ventana pequeña —
 * la renovación proactiva mantiene ese TTL corto invisible para el usuario
 * en vez de sacrificar confiabilidad por seguridad.
 */
function scheduleProactiveRefresh(accessToken: string | null): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
  if (!accessToken) return;
  const expiresAt = decodeJwtExpiryMs(accessToken);
  if (!expiresAt) return;
  const refreshInMs = Math.max(expiresAt - Date.now() - 60_000, 5_000);
  proactiveRefreshTimer = setTimeout(() => {
    renewAccessToken().catch(() => {
      // Que falle esta renovación en segundo plano no es grave: el próximo
      // request real chocará con un 401 y seguirá el flujo reactivo normal
      // de refresh/logout.
    });
  }, refreshInMs);
}

/**
 * @param t - Access token JWT, o `null` para limpiar la sesión.
 */
export function setApiToken(t: string | null): void {
  token = t;
  scheduleProactiveRefresh(t);
}

/**
 * Devuelve el token actual almacenado en memoria.
 */
export function getApiToken(): string | null {
  return token;
}

/**
 * Ejecuta `fn` serializado entre pestañas del navegador usando la Web Locks
 * API cuando está disponible. Los refresh tokens rotan en cada uso (solo hay
 * un token válido a la vez del lado del servidor) y la cookie HttpOnly la
 * comparten todas las pestañas del mismo navegador — sin esto, dos pestañas
 * refrescando con milisegundos de diferencia compiten entre sí: la que el
 * servidor procese en segundo lugar manda un refresh token que ya fue
 * rotado, y esa pestaña termina deslogueada aunque el usuario no hizo nada
 * mal. Serializar las llamadas (el lock encola el segundo request en vez de
 * descartarlo) hace que el request de la segunda pestaña salga recién
 * después de que la respuesta de la primera ya actualizó la cookie
 * compartida, así siempre ve el token vigente.
 */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    // lib.dom.d.ts tipa el retorno de LockGrantedCallback como el valor
    // resuelto T, no como Promise<T>, por lo que TS infiere aquí un
    // Promise<Promise<T>> duplicado — eso no coincide con el comportamiento
    // real de Web Locks (la spec espera la promesa devuelta antes de liberar
    // el lock y resuelve request() con su valor ya resuelto). Es un hueco
    // conocido de los tipos del DOM lib; el cast refleja el comportamiento
    // real en tiempo de ejecución.
    return navigator.locks.request('vitahub-token-refresh', fn) as unknown as Promise<T>;
  }
  return fn();
}

// Adjunta el token bearer a cada request saliente.
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
 * Extrae un mensaje legible para el usuario a partir de un error de axios.
 *
 * @param error - Error de axios capturado de un request fallido.
 * @returns Mensaje de error localizado.
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
    refreshPromise = withRefreshLock(() =>
      apiClient.post<{ accessToken: string }>('/auth/refresh', {}),
    )
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

// Renueva una vez el access token expirado y centraliza el manejo final de los 401.
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
        // Redirección dura (no navegación SPA) porque esto puede dispararse
        // fuera del árbol de render de React; el query param sobrevive al
        // reload para que LoginPage explique por qué el usuario llegó aquí
        // en vez de sacarlo silenciosamente en medio de un formulario.
        window.location.href = '/login?reason=session-expired';
      }
    }

    if (error.response?.status === 401 && !isRefreshRequest && !isLoginRequest) {
      setApiToken(null);
      window.location.href = '/login?reason=session-expired';
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
 * Helpers HTTP tipados construidos sobre `apiClient`.
 *
 * @template T - Tipo esperado del cuerpo de la respuesta.
 * @template B - Tipo del cuerpo del request para POST/PUT.
 */
export const api = {
  /**
   * Realiza un request GET.
   *
   * @param path - Ruta relativa de la API.
   * @param config - Configuración opcional de axios.
   */
  get<T = unknown>(path: string, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.get<T>(path, config).then((r) => r.data);
  },

  /**
   * Realiza un request POST.
   *
   * @param path - Ruta relativa de la API.
   * @param body - Payload del request.
   */
  post<T = unknown, B = unknown>(path: string, body?: B): Promise<T> {
    return apiClient.post<T>(path, body).then((r) => r.data);
  },

  /** Sube un archivo usando el endpoint multipart seguro. */
  upload<T = unknown>(path: string, file: File): Promise<T> {
    const body = new FormData();
    body.append('file', file);
    return apiClient.post<T>(path, body).then((r) => r.data);
  },

  /**
   * Realiza un request PUT.
   *
   * @param path - Ruta relativa de la API.
   * @param body - Payload del request.
   */
  put<T = unknown, B = unknown>(path: string, body?: B): Promise<T> {
    return apiClient.put<T>(path, body).then((r) => r.data);
  },

  /**
   * Realiza un request PATCH.
   *
   * @param path - Ruta relativa de la API.
   * @param body - Payload del request.
   */
  patch<T = unknown, B = unknown>(path: string, body?: B): Promise<T> {
    return apiClient.patch<T>(path, body).then((r) => r.data);
  },

  /**
   * Realiza un request DELETE.
   *
   * @param path - Ruta relativa de la API.
   */
  delete<T = unknown>(path: string): Promise<T> {
    return apiClient.delete<T>(path).then((r) => r.data);
  },
};

import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

/**
 * Métricas del ciclo de reserva que devuelve `GET /reservations/analytics/metrics`.
 */
export interface ReservationMetrics {
  totals: { total?: number; attended?: number; no_show?: number; pending?: number; confirmed?: number; cancelled?: number };
  daily: Array<{ day: string; total: number; attended: number; no_show: number }>;
  sources: Array<{ source: string; campaign: string; total: number; attended: number }>;
  funnel: { views: number; starts: number; completed: number; conversionRate: number | null };
  days: number;
}

/**
 * Cifras derivadas que varias vistas necesitan leer igual.
 *
 * La tasa de asistencia se calcula sobre reservas resueltas —asistió más no asistió— y no sobre
 * el total: incluir las que todavía no ocurrieron haría bajar la tasa por el solo hecho de tener
 * reservas futuras, que es exactamente lo contrario de lo que el número debe comunicar. Devuelve
 * `null` cuando no hay ninguna resuelta, para poder distinguir «sin datos» de «0%».
 */
export interface ReservationTotals {
  reservations: number;
  attended: number;
  noShow: number;
  pending: number;
  attendanceRate: number | null;
}

/**
 * Lee las métricas de reservas de un período.
 *
 * Centraliza la consulta para que el panel de resultados y las tarjetas del inicio compartan
 * la misma clave de caché: montados a la vez, resuelven con una sola llamada a la API y no
 * pueden mostrar cifras distintas del mismo período.
 *
 * @param days - Ventana en días.
 * @param clientId - Acota a un cliente; sin él, agrega todos los visibles para el usuario.
 */
export function useReservationMetrics(days: number, clientId?: string) {
  return useQuery<ReservationMetrics>({
    queryKey: ['reservation-metrics', days, clientId ?? null],
    queryFn: () => api.get(`/reservations/analytics/metrics?days=${days}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ''}`),
  });
}

/**
 * Normaliza los totales del período a números listos para mostrar.
 *
 * @param data - Respuesta de {@link useReservationMetrics}, o `undefined` mientras carga.
 */
export function reservationTotals(data?: ReservationMetrics): ReservationTotals {
  const totals = data?.totals ?? {};
  const attended = Number(totals.attended ?? 0);
  const noShow = Number(totals.no_show ?? 0);
  const resolved = attended + noShow;
  return {
    reservations: Number(totals.total ?? 0),
    attended,
    noShow,
    pending: Number(totals.pending ?? 0) + Number(totals.confirmed ?? 0),
    attendanceRate: resolved > 0 ? Math.round((attended / resolved) * 100) : null,
  };
}

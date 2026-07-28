/**
 * @fileoverview Tasa de asistencia, definida en un solo lugar.
 *
 * Es la métrica que da sentido al producto —mide cuánta de la gente que reservó llegó de
 * verdad— y aparece en el inicio, en la bandeja de reservas y en los contactos de campañas.
 * Tenerla escrita tres veces abre la puerta a que dos pantallas muestren números distintos
 * del mismo dato.
 */

/**
 * Calcula el porcentaje de asistencia sobre las reservas ya resueltas.
 *
 * El denominador son las reservas con resultado —asistió más no asistió— y no el total. Incluir
 * las reservas futuras haría caer la tasa por el solo hecho de tener agenda por delante, que es
 * lo contrario de lo que el número debe comunicar.
 *
 * @param attended - Reservas marcadas como asistidas.
 * @param noShow - Reservas marcadas como no asistidas.
 * @returns Porcentaje entero, o `null` si todavía no hay ninguna resuelta. `null` distingue
 * «sin datos» de «0%», que significan cosas muy distintas para quien lee.
 */
export function attendanceRateOf(attended?: number, noShow?: number): number | null {
  const attendedCount = Number(attended ?? 0);
  const resolved = attendedCount + Number(noShow ?? 0);
  if (resolved <= 0) return null;
  return Math.round((attendedCount / resolved) * 100);
}

/**
 * Formatea la tasa para mostrarla, con guion largo cuando no hay datos.
 *
 * @param rate - Resultado de {@link attendanceRateOf}.
 */
export function formatAttendanceRate(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`;
}

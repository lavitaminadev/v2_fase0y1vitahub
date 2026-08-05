import { BadRequestException } from '@nestjs/common';

export interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

export function assertTimeZone(timeZone: string): void {
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); } catch { throw new BadRequestException('Zona horaria inválida'); }
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  assertTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), weekday: weekdays[parts.weekday] };
}

export function localToUtc(date: string, time: string, timeZone: string): Date {
  assertTimeZone(timeZone);
  const [year, month, day] = date.split('-').map(Number); const [hour, minute] = time.split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) throw new BadRequestException('Fecha u hora inválida');
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess -= represented - Date.UTC(year, month - 1, day, hour, minute);
  }
  const result = new Date(guess); const check = zonedParts(result, timeZone);
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) throw new BadRequestException('La hora no existe en esa zona horaria');
  return result;
}

/**
 * Convierte una hora local a UTC, o `null` si esa hora no existe en la zona.
 *
 * Es la variante que usan los cálculos internos, donde una hora inexistente es un dato del
 * calendario y no un error de quien pide: en un salto de horario de verano simplemente hay
 * horas que no ocurrieron.
 */
export function tryLocalToUtc(date: string, time: string, timeZone: string): Date | null {
  try {
    return localToUtc(date, time, timeZone);
  } catch {
    return null;
  }
}

/**
 * Primer instante de un día local, expresado en UTC.
 *
 * Chile adelanta el reloj el primer domingo de septiembre saltando de las 23:59 a la 01:00,
 * así que **ese día las 00:00 no existen**. Calcular el límite del día con `localToUtc(…,
 * '00:00')` lanzaba una excepción y devolvía un 400: el tope diario dejaba de poder
 * evaluarse y el calendario público quedaba caído para cualquier consulta cuyo rango tocara
 * esa fecha, no solo para el día mismo.
 *
 * Ante un salto se avanza al primer minuto que sí existe, que es lo que el día realmente
 * empieza a valer.
 */
export function startOfLocalDayUtc(date: string, timeZone: string): Date {
  for (let hour = 0; hour < 4; hour += 1) {
    const candidate = tryLocalToUtc(date, `${String(hour).padStart(2, '0')}:00`, timeZone);
    if (candidate) return candidate;
  }
  throw new BadRequestException('No se pudo determinar el inicio del día en esa zona horaria');
}

export function addPlainDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day + days)); return date.toISOString().slice(0, 10);
}

export function plainDateParts(value: string) { const [year, month, day] = value.split('-').map(Number); return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }; }

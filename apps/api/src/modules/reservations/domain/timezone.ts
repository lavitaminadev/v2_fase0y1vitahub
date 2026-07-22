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

export function addPlainDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, day + days)); return date.toISOString().slice(0, 10);
}

export function plainDateParts(value: string) { const [year, month, day] = value.split('-').map(Number); return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }; }

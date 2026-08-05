import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { addPlainDays, localToUtc, startOfLocalDayUtc, tryLocalToUtc, zonedParts } from '../../../src/modules/reservations/domain/timezone';

describe('reservation timezone helpers', () => {
  it('preserves the requested wall-clock time in America/Santiago', () => {
    const utc = localToUtc('2026-07-20', '09:30', 'America/Santiago');
    expect(zonedParts(utc, 'America/Santiago')).toMatchObject({ year: 2026, month: 7, day: 20, hour: 9, minute: 30 });
  });

  it('moves plain dates without depending on the server timezone', () => {
    expect(addPlainDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('rejects an unknown timezone', () => {
    expect(() => localToUtc('2026-07-20', '09:30', 'Invalid/Vitahub')).toThrow(BadRequestException);
  });
});

/**
 * Chile adelanta el reloj el primer domingo de septiembre saltando de las 23:59 a la 01:00,
 * así que ese día las 00:00 no existen. Como el límite del día se calculaba con esa hora, el
 * tope diario dejaba de poder evaluarse y el calendario público devolvía 400 para cualquier
 * consulta cuyo rango tocara la fecha: con la ventana de 14 días del formulario, unas dos
 * semanas caídas cada septiembre.
 */
describe('timezone — salto de horario de verano', () => {
  const SANTIAGO = 'America/Santiago';
  const SALTOS = ['2025-09-07', '2026-09-06', '2027-09-05'];

  it.each(SALTOS)('las 00:00 del %s no existen en Santiago', (fecha) => {
    expect(() => localToUtc(fecha, '00:00', SANTIAGO)).toThrow(BadRequestException);
  });

  it.each(SALTOS)('el inicio del día %s se resuelve avanzando al primer minuto válido', (fecha) => {
    expect(startOfLocalDayUtc(fecha, SANTIAGO).getTime())
      .toBe(localToUtc(fecha, '01:00', SANTIAGO).getTime());
  });

  it('en un día normal el inicio sigue siendo la medianoche exacta', () => {
    expect(startOfLocalDayUtc('2026-09-07', SANTIAGO).getTime())
      .toBe(localToUtc('2026-09-07', '00:00', SANTIAGO).getTime());
  });

  it('el retroceso de abril no altera el inicio del día', () => {
    expect(startOfLocalDayUtc('2026-04-05', SANTIAGO).getTime())
      .toBe(localToUtc('2026-04-05', '00:00', SANTIAGO).getTime());
  });

  it('el inicio de un día es anterior al del siguiente incluso cruzando el salto', () => {
    // Es la propiedad de la que dependen los rangos: si se invirtiera, el conteo del tope
    // diario daría cero y el formulario aceptaría reservas por encima de su capacidad.
    expect(startOfLocalDayUtc('2026-09-06', SANTIAGO).getTime())
      .toBeLessThan(startOfLocalDayUtc('2026-09-07', SANTIAGO).getTime());
  });

  it('tryLocalToUtc devuelve null en vez de lanzar para una hora inexistente', () => {
    expect(tryLocalToUtc('2026-09-06', '00:30', SANTIAGO)).toBeNull();
    expect(tryLocalToUtc('2026-09-06', '13:00', SANTIAGO)).toBeInstanceOf(Date);
  });

  it('una zona sin horario de verano no cambia de comportamiento', () => {
    expect(startOfLocalDayUtc('2026-09-06', 'America/Bogota').toISOString()).toBe('2026-09-06T05:00:00.000Z');
  });
});

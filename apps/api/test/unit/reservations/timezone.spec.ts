import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { addPlainDays, localToUtc, zonedParts } from '../../../src/modules/reservations/domain/timezone';

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

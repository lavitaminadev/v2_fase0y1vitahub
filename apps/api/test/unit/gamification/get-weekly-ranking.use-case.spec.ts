import { describe, expect, it } from 'vitest';
import { getCurrentWeekStart } from '../../../src/modules/gamification/get-weekly-ranking.use-case';

function expectMondayAtMidnight(value: Date) {
  expect(value.getFullYear()).toBe(2026);
  expect(value.getMonth()).toBe(6);
  expect(value.getDate()).toBe(13);
  expect(value.getDay()).toBe(1);
  expect(value.getHours()).toBe(0);
  expect(value.getMinutes()).toBe(0);
}

describe('getCurrentWeekStart', () => {
  it('keeps Monday as the beginning of the current week', () => {
    expectMondayAtMidnight(getCurrentWeekStart(new Date(2026, 6, 13, 16, 30)));
  });

  it('moves Sunday back to the previous Monday instead of the next day', () => {
    expectMondayAtMidnight(getCurrentWeekStart(new Date(2026, 6, 19, 16, 30)));
  });
});

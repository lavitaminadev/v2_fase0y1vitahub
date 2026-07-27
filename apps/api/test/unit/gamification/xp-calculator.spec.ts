import { describe, it, expect } from 'vitest';
import { calculateDeliveryXp, calculateWeeklyTier, BASE_XP } from '../../../src/modules/gamification/xp-calculator';
import { XpTier } from '../../../src/modules/gamification/xp-tier.enum';

describe('XpCalculator', () => {
  describe('Base XP by level', () => {
    it('should return correct base XP for each level', () => {
      expect(BASE_XP[1]).toBe(5);
      expect(BASE_XP[2]).toBe(10);
      expect(BASE_XP[3]).toBe(20);
      expect(BASE_XP[4]).toBe(40);
      expect(BASE_XP[5]).toBe(80);
    });
  });

  describe('Early delivery bonus', () => {
    it('should add 50% base when actual is <=50% expected', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 3,
        actualHours: 1.2,
        expectedHours: 3,
        perfectNaming: true,
        hadDesignerErrorCorrection: false,
      });
      expect(xp).toBe(32);
    });

    it('should add 25% base when actual is within 51-75% of expected', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 3,
        actualHours: 2,
        expectedHours: 3,
        perfectNaming: false,
        hadDesignerErrorCorrection: false,
      });
      expect(xp).toBe(25);
    });
  });

  describe('Delay penalty without justification', () => {
    it('should reduce to 25% when overdue >2h and no justification', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 3,
        actualHours: 7,
        expectedHours: 3,
        perfectNaming: false,
        hadDesignerErrorCorrection: false,
        delayJustification: null,
      });
      expect(xp).toBe(5);
    });
  });

  describe('Delay penalty with justification', () => {
    it('should reduce to 50% when overdue >2h and justification provided', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 3,
        actualHours: 7,
        expectedHours: 3,
        perfectNaming: false,
        hadDesignerErrorCorrection: false,
        delayJustification: 'Client requested changes',
      });
      expect(xp).toBe(10);
    });
  });

  describe('Slight delay (<=2h)', () => {
    it('should reduce to 80% when overdue is <=2h', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 3,
        actualHours: 4,
        expectedHours: 3,
        perfectNaming: false,
        hadDesignerErrorCorrection: false,
      });
      expect(xp).toBe(16);
    });
  });

  describe('Designer error penalty', () => {
    it('should subtract 5 XP when designer error correction occurred', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 1,
        actualHours: 2,
        expectedHours: 2,
        perfectNaming: false,
        hadDesignerErrorCorrection: true,
      });
      expect(xp).toBe(0);
    });
  });

  describe('Weekly tier thresholds', () => {
    it('should return diamond for >=200', () => {
      expect(calculateWeeklyTier(200)).toBe(XpTier.DIAMOND);
    });

    it('should return platinum for >=150', () => {
      expect(calculateWeeklyTier(150)).toBe(XpTier.PLATINUM);
    });

    it('should return gold for >=100', () => {
      expect(calculateWeeklyTier(100)).toBe(XpTier.GOLD);
    });

    it('should return silver for >=60', () => {
      expect(calculateWeeklyTier(60)).toBe(XpTier.SILVER);
    });

    it('should return bronze for >=30', () => {
      expect(calculateWeeklyTier(30)).toBe(XpTier.BRONZE);
    });

    it('should return null for <30', () => {
      expect(calculateWeeklyTier(29)).toBeNull();
    });
  });

  describe('Naming bonus', () => {
    it('should add +2 XP for perfect naming', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 1,
        actualHours: 2,
        expectedHours: 2,
        perfectNaming: true,
        hadDesignerErrorCorrection: false,
      });
      expect(xp).toBe(7);
    });
  });

  describe('Minimum XP (never negative)', () => {
    it('should return 0 when result would be negative', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 1,
        actualHours: 2,
        expectedHours: 2,
        perfectNaming: false,
        hadDesignerErrorCorrection: true,
      });
      expect(xp).toBe(0);
    });

    it('should never go below 0 even with multiple penalties', () => {
      const xp = calculateDeliveryXp({
        difficultyLevel: 1,
        actualHours: 10,
        expectedHours: 2,
        perfectNaming: false,
        hadDesignerErrorCorrection: true,
        delayJustification: null,
      });
      expect(xp).toBe(0);
    });
  });

  describe('All 9 piece types coverage', () => {
    it('should calculate XP for every difficulty level 1-5', () => {
      for (let level = 1; level <= 5; level++) {
        const xp = calculateDeliveryXp({
          difficultyLevel: level,
          actualHours: 1,
          expectedHours: 2,
          perfectNaming: false,
          hadDesignerErrorCorrection: false,
        });
        expect(xp).toBeGreaterThan(0);
      }
    });
  });
});

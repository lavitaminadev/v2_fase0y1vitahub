import { describe, it, expect } from 'vitest';
import { calculatePieceUd } from '../../../src/modules/design-budget/ud-calculator';

describe('UdBudgetCalculator', () => {
  describe('standard piece types', () => {
    it('should return 1.0 for post_simple', () => {
      expect(calculatePieceUd('post_simple')).toBeCloseTo(1.0);
    });

    it('should return 1.5 for post_author', () => {
      expect(calculatePieceUd('post_author')).toBeCloseTo(1.5);
    });

    it('should return 0.4 for story_original', () => {
      expect(calculatePieceUd('story_original')).toBeCloseTo(0.4);
    });

    it('should return 0.1 for story_adapted', () => {
      expect(calculatePieceUd('story_adapted')).toBeCloseTo(0.1);
    });

    it('should return 0.2 for story_template', () => {
      expect(calculatePieceUd('story_template')).toBeCloseTo(0.2);
    });

    it('should return 0.3 for reel_cover', () => {
      expect(calculatePieceUd('reel_cover')).toBeCloseTo(0.3);
    });

    it('should return 1.5 for flyer_digital', () => {
      expect(calculatePieceUd('flyer_digital')).toBeCloseTo(1.5);
    });

    it('should return 2.0 for flyer_print', () => {
      expect(calculatePieceUd('flyer_print')).toBeCloseTo(2.0);
    });

    it('should return default 1.0 for unknown piece type', () => {
      expect(calculatePieceUd('unknown_type')).toBeCloseTo(1.0);
    });
  });

  describe('carousel edge cases', () => {
    it('should return 1.0 for carousel with 0 slides', () => {
      expect(calculatePieceUd('carousel', 0)).toBeCloseTo(1.0);
    });

    it('should return 1.0 for carousel with 1 slide', () => {
      expect(calculatePieceUd('carousel', 1)).toBeCloseTo(1.0);
    });

    it('should return 1.4 for carousel with 2 slides', () => {
      expect(calculatePieceUd('carousel', 2)).toBeCloseTo(1.4);
    });

    it('should return 2.6 for carousel with 5 slides', () => {
      expect(calculatePieceUd('carousel', 5)).toBeCloseTo(2.6);
    });

    it('should handle large number of slides', () => {
      expect(calculatePieceUd('carousel', 100)).toBeCloseTo(40.6);
    });
  });
});

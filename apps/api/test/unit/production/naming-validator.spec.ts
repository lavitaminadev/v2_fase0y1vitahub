import { describe, it, expect } from 'vitest';
import { validate, isValid, extractState } from '../../../src/modules/production/naming-validator';

describe('NamingValidator', () => {
  const clientCode = 'GRDS';

  describe('validate', () => {
    it('should accept a valid naming with FINAL state', () => {
      const result = validate('GRDS_FLYER-LANZAMIENTO_FEED-1080x1080_v2_FINAL', clientCode);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept a valid naming with BORRADOR state', () => {
      const result = validate('GRDS_POST-SIMPLE_INSTA_v1_BORRADOR', clientCode);
      expect(result.isValid).toBe(true);
    });

    it('should accept a valid naming with REVISION state', () => {
      const result = validate('GRDS_CAROUSEL_FEED-1080x1080_v3_REVISION', clientCode);
      expect(result.isValid).toBe(true);
    });

    it('should reject when missing version prefix', () => {
      const result = validate('GRDS_FLYER-LANZAMIENTO_FEED-1080x1080_FINAL', clientCode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Falta versión con prefijo v (ej. v2). Formato: _vN_');
    });

    it('should reject when name has spaces', () => {
      const result = validate('GRDS FLYER_v1_FINAL', clientCode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No se permiten espacios en el nombre');
    });

    it('should reject invalid characters', () => {
      const result = validate('GRDS_FLYER_v1_FINAL!', clientCode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Solo caracteres alfanuméricos, guiones, underscores y puntos');
    });

    it('should reject wrong client code prefix', () => {
      const result = validate('OTRO_CLIENTE_FLYER_v1_FINAL', clientCode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Debe comenzar con el código del cliente en mayúsculas (GRDS_)');
    });

    it('should reject invalid state suffix', () => {
      const result = validate('GRDS_FLYER_v1_APROBADO', clientCode);
      expect(result.isValid).toBe(false);
    });
  });

  describe('isValid', () => {
    it('should return true for valid name', () => {
      expect(isValid('GRDS_POST_FEED_v1_FINAL', clientCode)).toBe(true);
    });

    it('should return false for invalid name', () => {
      expect(isValid('bad name', clientCode)).toBe(false);
    });
  });

  describe('extractState', () => {
    it('should extract FINAL', () => {
      expect(extractState('GRDS_POST_v1_FINAL')).toBe('FINAL');
    });

    it('should extract BORRADOR', () => {
      expect(extractState('GRDS_POST_v1_BORRADOR')).toBe('BORRADOR');
    });

    it('should extract REVISION', () => {
      expect(extractState('GRDS_POST_v1_REVISION')).toBe('REVISION');
    });

    it('should return null if no state match', () => {
      expect(extractState('GRDS_POST_v1')).toBeNull();
    });
  });
});

import { describe, expect, it } from 'vitest';
import { inferLocationFromPhone, normalizeGeoValue } from '../../../src/shared/geo-inference';

describe('normalizeGeoValue', () => {
  it('quita acentos, espacios y puntuación', () => {
    expect(normalizeGeoValue('Valparaíso')).toBe('valparaiso');
    expect(normalizeGeoValue("O'Higgins")).toBe('ohiggins');
    expect(normalizeGeoValue('Region Metropolitana de Santiago')).toBe('regionmetropolitanadesantiago');
    expect(normalizeGeoValue('Ñuble')).toBe('nuble');
  });
});

describe('inferLocationFromPhone', () => {
  it('devuelve vacío cuando no hay teléfono', () => {
    expect(inferLocationFromPhone(null)).toEqual({});
    expect(inferLocationFromPhone(undefined)).toEqual({});
    expect(inferLocationFromPhone('')).toEqual({});
    expect(inferLocationFromPhone('sin-digitos')).toEqual({});
  });

  it('infiere solo país para móviles chilenos', () => {
    expect(inferLocationFromPhone('+56912345678')).toEqual({ country: 'cl' });
    // Formato local de 9 dígitos, sin código de país
    expect(inferLocationFromPhone('912345678')).toEqual({ country: 'cl' });
  });

  it('infiere región y ciudad para fijos de Santiago', () => {
    expect(inferLocationFromPhone('+56221234567')).toEqual({
      country: 'cl',
      region: 'regionmetropolitanadesantiago',
      city: 'santiago',
    });
  });

  it('infiere región y ciudad para fijos de regiones', () => {
    expect(inferLocationFromPhone('+56322123456')).toEqual({
      country: 'cl', region: 'valparaiso', city: 'valparaiso',
    });
    expect(inferLocationFromPhone('+56412123456')).toEqual({
      country: 'cl', region: 'biobio', city: 'concepcion',
    });
    expect(inferLocationFromPhone('+56452123456')).toEqual({
      country: 'cl', region: 'laaraucania', city: 'temuco',
    });
    expect(inferLocationFromPhone('+56722123456')).toEqual({
      country: 'cl', region: 'ohiggins', city: 'rancagua',
    });
  });

  it('tolera formatos con espacios, guiones y paréntesis', () => {
    expect(inferLocationFromPhone('+56 (2) 2123 4567')).toEqual({
      country: 'cl',
      region: 'regionmetropolitanadesantiago',
      city: 'santiago',
    });
  });

  it('infiere país para números extranjeros sin deducir región', () => {
    expect(inferLocationFromPhone('+5491123456789')).toEqual({ country: 'ar' });
    expect(inferLocationFromPhone('+34612345678')).toEqual({ country: 'es' });
  });

  it('prefiere el prefijo más largo cuando hay ambigüedad', () => {
    // 591 (Bolivia) debe ganar sobre 59x parciales
    expect(inferLocationFromPhone('+59171234567')).toEqual({ country: 'bo' });
  });

  it('devuelve solo país si el prefijo de área chileno no está mapeado', () => {
    // 39 no existe en el plan de numeración
    expect(inferLocationFromPhone('+56392123456')).toEqual({ country: 'cl' });
  });
});

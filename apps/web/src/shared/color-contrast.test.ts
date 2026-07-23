import { describe, expect, it } from 'vitest';
import { accessibleForeground, contrastRatio, contrastText, normalizeHexColor } from './color-contrast.ts';

describe('color-contrast', () => {
  it('normalizeHexColor returns the value for valid hex colors', () => {
    expect(normalizeHexColor('#ffffff', '#000000')).toBe('#ffffff');
  });
  it('normalizeHexColor returns the fallback for undefined', () => {
    expect(normalizeHexColor(undefined, '#000000')).toBe('#000000');
  });
  it('contrastRatio computes the WCAG ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThan(10);
  });
  it('contrastText returns white on dark backgrounds', () => {
    expect(contrastText('#173f35')).toBe('#ffffff');
  });
  it('accessibleForeground prefers the accessible color', () => {
    expect(accessibleForeground('#ffffff', '#173f35', '#17211e')).toBe('#ffffff');
  });
});

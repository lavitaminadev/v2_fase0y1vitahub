import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_SETTINGS,
  validateOrganizationSettingValue,
} from '../../../src/core/parameters/organization-settings.catalog';

describe('organization settings catalog', () => {
  const byKey = (key: string) => ORGANIZATION_SETTINGS.find((setting) => setting.key === key)!;

  it('preserves the rules already defined by the master document', () => {
    expect(byKey('production.stale_hours').defaultValue).toBe(48);
    expect(byKey('production.max_client_corrections').defaultValue).toBe(3);
    expect(byKey('documents.final_immutable').defaultValue).toBe(true);
  });

  it('rejects values outside their operational range', () => {
    expect(() => validateOrganizationSettingValue(byKey('ud.warning_threshold_percent'), 101))
      .toThrow('no puede ser mayor que 100');
  });

  it('rejects unknown select options', () => {
    expect(() => validateOrganizationSettingValue(byKey('ud.limit_action'), 'invoice'))
      .toThrow('opción no permitida');
  });

  it('accepts an undefined internal UD cost without exposing a fake value', () => {
    expect(validateOrganizationSettingValue(byKey('ud.internal_cost'), null)).toBeNull();
  });
});

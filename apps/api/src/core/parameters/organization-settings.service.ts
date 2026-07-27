import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { ParameterDefinition } from './parameter-definition.entity';
import { ParameterResolver } from './parameter-resolver.service';
import { ParameterValue } from './parameter-value.entity';
import {
  ORGANIZATION_SETTINGS,
  validateOrganizationSettingValue,
} from './organization-settings.catalog';

@Injectable()
export class OrganizationSettingsService {
  constructor(
    @InjectRepository(ParameterDefinition) private readonly definitionRepo: Repository<ParameterDefinition>,
    @InjectRepository(ParameterValue) private readonly valueRepo: Repository<ParameterValue>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly resolver: ParameterResolver,
  ) {}

  async list(organizationId: string) {
    const definitions = await this.ensureDefinitions();
    const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const values = await this.valueRepo.find({
      where: {
        definitionId: In(definitions.map((definition) => definition.id)),
        scopeType: 'organization',
        scopeId: organizationId,
        validTo: IsNull(),
      },
    });
    const valueByDefinition = new Map(values.map((value) => [value.definitionId, value]));

    return ORGANIZATION_SETTINGS.map((setting) => {
      const definition = definitionByKey.get(setting.key)!;
      const override = valueByDefinition.get(definition.id);
      return {
        ...setting,
        value: override?.valueJson?.value ?? setting.defaultValue,
        source: override ? 'organization' : 'master_default',
        version: override?.version ?? 0,
      };
    });
  }

  async update(organizationId: string, actorId: string, requestedValues: Record<string, unknown>) {
    const catalogByKey = new Map(ORGANIZATION_SETTINGS.map((setting) => [setting.key, setting]));
    const normalizedValues = new Map<string, string | number | boolean | null>();

    for (const [key, value] of Object.entries(requestedValues)) {
      const setting = catalogByKey.get(key);
      if (!setting) throw new BadRequestException(`La configuración "${key}" no existe`);
      try {
        normalizedValues.set(key, validateOrganizationSettingValue(setting, value));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'no es válida';
        throw new BadRequestException(`${setting.label}: ${message}`);
      }
    }

    const definitions = await this.ensureDefinitions();
    const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    await this.dataSource.transaction(async (manager) => {
      const valueRepo = manager.getRepository(ParameterValue);
      const now = new Date();

      for (const [key, value] of normalizedValues) {
        const definition = definitionByKey.get(key)!;
        const active = await valueRepo.findOne({
          where: {
            definitionId: definition.id,
            scopeType: 'organization',
            scopeId: organizationId,
            validTo: IsNull(),
          },
          order: { version: 'DESC' },
        });
        const previous = active?.valueJson?.value ?? definition.defaultValue?.value ?? null;
        if (JSON.stringify(previous) === JSON.stringify(value)) continue;

        if (active) {
          active.validTo = now;
          await valueRepo.save(active);
        }
        await valueRepo.save(valueRepo.create({
          definitionId: definition.id,
          scopeType: 'organization',
          scopeId: organizationId,
          valueJson: { value },
          version: (active?.version ?? 0) + 1,
          validFrom: now,
        }));
        before[key] = previous;
        after[key] = value;
      }
    });

    if (Object.keys(after).length > 0) {
      await this.audit.log({
        organizationId,
        actorId,
        entityType: 'organization_settings',
        entityId: organizationId,
        action: 'update',
        before,
        after,
        reason: 'Actualización desde Configuración Central',
      });
      for (const key of Object.keys(after)) this.resolver.invalidate(key, null, null, organizationId);
    }

    return this.list(organizationId);
  }

  private async ensureDefinitions(): Promise<ParameterDefinition[]> {
    const keys = ORGANIZATION_SETTINGS.map((setting) => setting.key);
    const existing = await this.definitionRepo.find({ where: { key: In(keys) } });
    const existingKeys = new Set(existing.map((definition) => definition.key));
    const missing = ORGANIZATION_SETTINGS.filter((setting) => !existingKeys.has(setting.key));

    if (missing.length > 0) {
      await this.definitionRepo.createQueryBuilder()
        .insert()
        .values(missing.map((setting) => ({
          key: setting.key,
          description: setting.description,
          defaultValue: { value: setting.defaultValue as any },
        })))
        .orIgnore()
        .execute();
    }
    return this.definitionRepo.find({ where: { key: In(keys) } });
  }
}

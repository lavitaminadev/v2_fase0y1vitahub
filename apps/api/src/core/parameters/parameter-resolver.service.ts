import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { ParameterDefinition } from './parameter-definition.entity';
import { ParameterValue } from './parameter-value.entity';

interface CacheEntry {
  value: any;
  expiresAt: number;
}

@Injectable()
export class ParameterResolver {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 60_000;

  constructor(
    @InjectRepository(ParameterDefinition) private definitionRepo: Repository<ParameterDefinition>,
    @InjectRepository(ParameterValue) private valueRepo: Repository<ParameterValue>,
  ) {}

  async get(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): Promise<any> {
    const cacheKey = this.cacheKey(key, clientId, planId, organizationId);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await this.resolveFromDb(key, clientId, planId, organizationId);

    this.cache.set(cacheKey, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  async getFresh(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): Promise<any> {
    this.invalidate(key, clientId, planId, organizationId);
    return this.get(key, clientId, planId, organizationId);
  }

  invalidate(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): void {
    this.cache.delete(this.cacheKey(key, clientId, planId, organizationId));
  }

  private cacheKey(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): string {
    return `param:${key}:${clientId ?? 'null'}:${planId ?? 'null'}:${organizationId ?? 'null'}`;
  }

  private async resolveFromDb(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): Promise<any> {
    const definition = await this.definitionRepo.findOne({ where: { key } });
    if (!definition) return null;

    if (clientId) {
      const value = await this.findActiveValue(definition.id, 'client', clientId);
      if (value !== null) return value;
    }

    if (planId) {
      const value = await this.findActiveValue(definition.id, 'plan', planId);
      if (value !== null) return value;
    }

    if (organizationId) {
      const value = await this.findActiveValue(definition.id, 'organization', organizationId);
      if (value !== null) return value;
    }

    return definition.defaultValue?.value ?? null;
  }

  private async findActiveValue(definitionId: string, scopeType: string, scopeId: string): Promise<any> {
    const now = new Date();
    const value = await this.valueRepo.findOne({
      where: [
        { definitionId, scopeType, scopeId, validFrom: LessThanOrEqual(now), validTo: IsNull() },
        { definitionId, scopeType, scopeId, validFrom: LessThanOrEqual(now), validTo: MoreThanOrEqual(now) },
      ],
      order: { version: 'DESC' },
    });

    return value?.valueJson?.value ?? null;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Lead } from '../lead.entity';

/** Filtros aceptados al listar leads. */
export interface ListLeadsFilters {
  status?: string;
  fitStatus?: string;
  source?: string;
  /** Cliente concreto solicitado por quien consulta. */
  clientId?: string;
  /**
   * Cuentas que el usuario tiene permitido ver.
   *
   * `undefined` habilita toda la organización. Un arreglo vacío no devuelve resultados,
   * que es el comportamiento esperado para un usuario sin cuentas asignadas.
   */
  allowedClientIds?: string[];
}

/** Página de leads acompañada del total de coincidencias. */
export interface ListLeadsResult {
  data: Lead[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class ListLeadsUseCase {
  constructor(
    @InjectRepository(Lead) private repo: Repository<Lead>,
  ) {}

  /**
   * Lista los leads de una organización, del más reciente al más antiguo.
   *
   * @param organizationId - Organización a la que pertenecen los leads.
   * @param limit - Tamaño de página.
   * @param offset - Registros a saltar.
   * @param filters - Filtros opcionales y alcance de cuentas permitido.
   * @returns Página de leads y el total que cumple los filtros.
   */
  async execute(
    organizationId: string,
    limit = 20,
    offset = 0,
    filters: ListLeadsFilters = {},
  ): Promise<ListLeadsResult> {
    const where: FindOptionsWhere<Lead> = { organizationId } as FindOptionsWhere<Lead>;
    if (filters.status) where.status = filters.status as Lead['status'];
    if (filters.fitStatus) where.fitStatus = filters.fitStatus as Lead['fitStatus'];
    if (filters.source) where.source = filters.source;

    const scope = this.resolveClientScope(filters);
    if (scope === EMPTY_SCOPE) return { data: [], total: 0, limit, offset };
    if (scope !== undefined) where.clientId = scope;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
  }

  /**
   * Combina el cliente solicitado con las cuentas permitidas.
   *
   * @returns Criterio a aplicar sobre `clientId`, `undefined` para no filtrar, o
   *   `EMPTY_SCOPE` cuando la combinación no puede devolver resultados.
   */
  private resolveClientScope(filters: ListLeadsFilters): FindOptionsWhere<Lead>['clientId'] | typeof EMPTY_SCOPE {
    const { clientId, allowedClientIds } = filters;
    if (allowedClientIds === undefined) return clientId;
    if (allowedClientIds.length === 0) return EMPTY_SCOPE;
    if (clientId) return allowedClientIds.includes(clientId) ? clientId : EMPTY_SCOPE;
    return In(allowedClientIds);
  }
}

/** Marca un alcance que no puede coincidir con ningún registro. */
const EMPTY_SCOPE = Symbol('empty-client-scope');

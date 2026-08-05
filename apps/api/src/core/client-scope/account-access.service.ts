import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthUser } from '../../shared/types/request';
import { Client } from '../../modules/clients/client.entity';
import { PodMember } from '../../modules/pods/pod-member.entity';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { UserClientAccess } from './user-client-access.entity';

/** Procedencia de una cuenta visible, para poder explicar por qué alguien la ve. */
export interface ClientAccessReason {
  clientId: string;
  source: 'pod' | 'assignment' | 'community-manager';
}

/**
 * Decide qué cuentas de la agencia puede ver cada persona.
 *
 * El acceso se compone de tres vías que se suman:
 *
 * 1. **Pod** — quien integra un pod ve las cuentas asignadas a ese pod. Es la vía normal y
 *    la única que no exige mantenimiento aparte: se entra al pod y las cuentas siguen.
 * 2. **Asignación directa** — excepciones en `user_client_access`, para prestar una cuenta
 *    sin mover a nadie de pod ni alterar la capacidad del pod.
 * 3. **Community manager** — la cuenta apunta a la persona en `community_manager_id`.
 *
 * Solo la administración ve todas las cuentas sin asignación. Las direcciones también se
 * acotan: dirigir un área no implica necesitar los datos de todas las cuentas, y acotarlo
 * limita lo que queda expuesto si una sesión se ve comprometida.
 *
 * `undefined` significa "sin límite" y un arreglo vacío significa "ninguna cuenta". La
 * distinción importa: ante un arreglo vacío hay que filtrar por una condición imposible y
 * no omitir el filtro, que es como un alcance vacío se convierte en acceso total.
 */
@Injectable()
export class AccountAccessService {
  private static readonly CACHE_TTL_MS = 30_000;
  private readonly cache = new Map<string, { clientIds: string[]; expiresAt: number }>();

  constructor(
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(PodMember) private readonly podMembers: Repository<PodMember>,
    @InjectRepository(UserClientAccess) private readonly assignments: Repository<UserClientAccess>,
  ) {}

  /**
   * Cuentas que la persona puede ver.
   *
   * @returns `undefined` cuando no tiene límite, o la lista de ids permitidos.
   */
  async allowedClientIds(organizationId: string, user: AuthUser): Promise<string[] | undefined> {
    if ((user.role as UserRole) === UserRole.ADMIN) return undefined;
    if ((user.role as UserRole) === UserRole.CLIENT) return user.clientId ? [user.clientId] : [];

    const cacheKey = `${organizationId}:${user.id}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.clientIds;

    const reasons = await this.resolve(organizationId, user.id);
    const clientIds = [...new Set(reasons.map((item) => item.clientId))];
    this.cache.set(cacheKey, { clientIds, expiresAt: Date.now() + AccountAccessService.CACHE_TTL_MS });
    return clientIds;
  }

  /**
   * Verifica que la persona pueda operar sobre una cuenta.
   *
   * Responde 404 y no 403 cuando no la alcanza: confirmar que una cuenta existe pero está
   * vedada ya revela la cartera de clientes de la agencia.
   *
   * @param clientId - Cuenta a verificar; sin valor no hay nada que comprobar.
   */
  async assertClient(organizationId: string, user: AuthUser, clientId?: string): Promise<void> {
    if (!clientId) return;

    const client = await this.clients.findOne({ where: { id: clientId, organizationId }, select: { id: true } });
    if (!client) throw new NotFoundException('Client not found');

    const allowed = await this.allowedClientIds(organizationId, user);
    if (allowed === undefined) return;
    if (!allowed.includes(client.id)) throw new NotFoundException('Client not found');
  }

  /**
   * Cuentas visibles junto con la procedencia de cada una.
   *
   * Responde "¿por qué esta persona ve esta cuenta?" sin reconstruir la decisión a mano, que
   * es lo que se necesita al revisar accesos o al atender un reclamo.
   */
  async explain(organizationId: string, user: AuthUser): Promise<ClientAccessReason[] | 'unrestricted'> {
    if ((user.role as UserRole) === UserRole.ADMIN) return 'unrestricted';
    if ((user.role as UserRole) === UserRole.CLIENT) {
      return user.clientId ? [{ clientId: user.clientId, source: 'assignment' }] : [];
    }
    return this.resolve(organizationId, user.id);
  }

  /** Descarta lo memorizado de una persona tras cambiar sus pods o sus asignaciones. */
  invalidateUser(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${userId}`)) this.cache.delete(key);
    }
  }

  /** Descarta todo lo memorizado tras un cambio que afecta a varias personas a la vez. */
  invalidateAll(): void {
    this.cache.clear();
  }

  private async resolve(organizationId: string, userId: string): Promise<ClientAccessReason[]> {
    const memberships = await this.podMembers.find({ where: { userId }, select: { podId: true } });
    const podIds = memberships.map((item) => item.podId);

    const [podClients, assignments, managed] = await Promise.all([
      podIds.length
        ? this.clients.find({ where: { organizationId, podId: In(podIds) }, select: { id: true } })
        : Promise.resolve<Client[]>([]),
      this.assignments.find({ where: { organizationId, userId }, select: { clientId: true } }),
      this.clients.find({ where: { organizationId, communityManagerId: userId }, select: { id: true } }),
    ]);

    return [
      ...podClients.map((client) => ({ clientId: client.id, source: 'pod' as const })),
      ...assignments.map((item) => ({ clientId: item.clientId, source: 'assignment' as const })),
      ...managed.map((client) => ({ clientId: client.id, source: 'community-manager' as const })),
    ];
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { CreatePodDto, UpdatePodDto } from './dto/pod.dto';
import { PodMember } from './pod-member.entity';
import { Pod } from './pod.entity';

@Injectable()
export class PodsService {
  constructor(
    @InjectRepository(Pod) private readonly pods: Repository<Pod>,
    @InjectRepository(PodMember) private readonly members: Repository<PodMember>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {}

  async list(organizationId: string) {
    const pods = await this.pods.find({ where: { organizationId }, order: { name: 'ASC' } });
    return Promise.all(pods.map(async (pod) => {
      const memberRecords = await this.members.find({ where: { podId: pod.id } });
      const memberIds = memberRecords.map((item) => item.userId);
      const [podUsers, podClients]: [User[], Client[]] = await Promise.all([
        memberIds.length ? this.users.find({ where: { organizationId, id: In(memberIds) }, order: { name: 'ASC' } }) : Promise.resolve([] as User[]),
        this.clients.find({ where: { organizationId, podId: pod.id }, order: { name: 'ASC' } }),
      ]);
      return {
        ...pod,
        members: podUsers.map(({ id, name, role, workMode }) => ({ id, name, role, workMode })),
        clients: podClients.map(({ id, name, status, defaultUdBudget }) => ({ id, name, status, defaultUdBudget })),
      };
    }));
  }

  async create(organizationId: string, dto: CreatePodDto): Promise<Pod> {
    await this.validateLeader(dto.leaderId, organizationId);
    const duplicate = await this.pods.findOne({ where: { organizationId, name: dto.name.trim() } });
    if (duplicate) throw new BadRequestException('Ya existe un pod con este nombre');
    return this.pods.save(this.pods.create({ ...dto, organizationId, name: dto.name.trim(), description: dto.description?.trim() || undefined }));
  }

  async update(id: string, organizationId: string, dto: UpdatePodDto): Promise<Pod> {
    const pod = await this.find(id, organizationId);
    await this.validateLeader(dto.leaderId, organizationId);
    Object.assign(pod, dto);
    if (dto.name !== undefined) pod.name = dto.name.trim();
    if (dto.description !== undefined) pod.description = dto.description.trim() || undefined;
    return this.pods.save(pod);
  }

  async setMembers(id: string, organizationId: string, userIds: string[]) {
    const pod = await this.find(id, organizationId);
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length) {
      const users = await this.users.find({ where: { organizationId, id: In(uniqueIds), isActive: true } });
      if (users.length !== uniqueIds.length || users.some((user) => user.role === 'client')) throw new BadRequestException('Todos los integrantes deben ser usuarios internos activos');
    }
    await this.members.manager.transaction(async (manager) => {
      await manager.delete(PodMember, { podId: pod.id });
      if (uniqueIds.length) await manager.save(PodMember, uniqueIds.map((userId) => manager.create(PodMember, { podId: pod.id, userId })));
    });
    return this.list(organizationId);
  }

  async setClients(id: string, organizationId: string, clientIds: string[]) {
    const pod = await this.find(id, organizationId);
    const uniqueIds = [...new Set(clientIds)];
    if (uniqueIds.length) {
      const clients = await this.clients.find({ where: { organizationId, id: In(uniqueIds) } });
      if (clients.length !== uniqueIds.length) throw new BadRequestException('Una o más cuentas no pertenecen a la organización');
    }
    await this.clients.manager.transaction(async (manager) => {
      await manager.createQueryBuilder().update(Client).set({ podId: undefined }).where('organization_id = :organizationId AND pod_id = :podId', { organizationId, podId: pod.id }).execute();
      if (uniqueIds.length) await manager.createQueryBuilder().update(Client).set({ podId: pod.id }).where('organization_id = :organizationId AND id IN (:...ids)', { organizationId, ids: uniqueIds }).execute();
    });
    return this.list(organizationId);
  }

  async remove(id: string, organizationId: string): Promise<{ archived: true }> {
    const pod = await this.find(id, organizationId);
    pod.status = 'archived';
    await this.pods.save(pod);
    return { archived: true };
  }

  private async find(id: string, organizationId: string): Promise<Pod> {
    const pod = await this.pods.findOne({ where: { id, organizationId } });
    if (!pod) throw new NotFoundException('Pod no encontrado');
    return pod;
  }

  private async validateLeader(leaderId: string | undefined, organizationId: string): Promise<void> {
    if (!leaderId) return;
    const leader = await this.users.findOne({ where: { id: leaderId, organizationId, isActive: true } });
    if (!leader || leader.role === 'client') throw new BadRequestException('El líder debe ser un usuario interno activo');
  }
}

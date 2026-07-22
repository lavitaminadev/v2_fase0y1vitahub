import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { Client } from '../clients/client.entity';

/**
 * Business logic for client contracts.
 */
@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract) private readonly repo: Repository<Contract>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
  ) {}

  async create(dto: CreateContractDto, organizationId: string): Promise<Contract> {
    const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
    if (!client) throw new BadRequestException('El cliente no pertenece a esta organización');
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;
    if (endDate && endDate < startDate) throw new BadRequestException('La fecha de término no puede ser anterior al inicio');
    const contract = this.repo.create({
      ...dto,
      organizationId,
      name: dto.name.trim(),
      serviceType: dto.serviceType?.trim() || undefined,
      startDate,
      endDate,
    });
    const saved = await this.repo.save(contract);
    if (saved.status === 'active') {
      client.defaultUdBudget = Number(saved.monthlyUd || client.defaultUdBudget);
      if (Number(saved.monthlyPrice) > 0) client.retainerAmount = Number(saved.monthlyPrice);
      await this.clients.save(client);
    }
    return saved;
  }

  async findAll(organizationId: string, limit = 50, offset = 0): Promise<{ data: Contract[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.repo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: ['client'],
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string): Promise<Contract> {
    const contract = await this.repo.findOne({ where: { id, organizationId }, relations: ['client'] });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async update(id: string, dto: UpdateContractDto, organizationId: string): Promise<Contract> {
    const contract = await this.findOne(id, organizationId);
    const endDate = dto.endDate ? new Date(dto.endDate) : contract.endDate;
    if (endDate && endDate < new Date(contract.startDate)) throw new BadRequestException('La fecha de término no puede ser anterior al inicio');
    Object.assign(contract, dto);
    if (dto.name !== undefined) contract.name = dto.name.trim();
    if (dto.serviceType !== undefined) contract.serviceType = dto.serviceType.trim() || undefined;
    if (dto.endDate !== undefined) contract.endDate = endDate;
    const saved = await this.repo.save(contract);
    if (saved.clientId && saved.status === 'active') {
      const client = await this.clients.findOne({ where: { id: saved.clientId, organizationId } });
      if (client) {
        client.defaultUdBudget = Number(saved.monthlyUd || client.defaultUdBudget);
        if (Number(saved.monthlyPrice) > 0) client.retainerAmount = Number(saved.monthlyPrice);
        await this.clients.save(client);
      }
    }
    return saved;
  }

  async remove(id: string, organizationId: string): Promise<Contract> {
    const contract = await this.findOne(id, organizationId);
    return this.repo.remove(contract);
  }
}

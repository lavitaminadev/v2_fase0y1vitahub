import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentGrid } from './content-grid.entity';
import { Client } from '../clients/client.entity';

@Injectable()
export class CreateContentGridUseCase {
  constructor(
    @InjectRepository(ContentGrid) private repo: Repository<ContentGrid>,
    @InjectRepository(Client) private clients: Repository<Client>,
  ) {}

  async execute(data: { organizationId: string; clientId: string; title: string; weekStart: Date; weekEnd: Date; notes?: string }) {
    const client = await this.clients.findOne({ where: { id: data.clientId, organizationId: data.organizationId } });
    if (!client) throw new BadRequestException('El cliente no pertenece a esta organización');
    if (data.weekEnd < data.weekStart) throw new BadRequestException('El cierre de la parrilla no puede ser anterior al inicio');
    const grid = this.repo.create({ ...data, title: data.title.trim(), notes: data.notes?.trim() || undefined });
    return this.repo.save(grid);
  }
}

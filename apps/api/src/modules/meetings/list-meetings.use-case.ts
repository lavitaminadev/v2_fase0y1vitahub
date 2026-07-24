import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Meeting } from './meeting.entity';

@Injectable()
export class ListMeetingsUseCase {
  constructor(
    @InjectRepository(Meeting) private repo: Repository<Meeting>,
  ) {}

  async execute(organizationId: string, type?: string, clientId?: string, clientIds?: string[]) {
    const where: FindOptionsWhere<Meeting> = { organizationId } as FindOptionsWhere<Meeting>;
    if (type) where.type = type as Meeting['type'];
    if (clientId) where.clientId = clientId;
    if (clientIds !== undefined) where.clientId = In(clientIds);
    return this.repo.find({ where, order: { scheduledAt: 'DESC' }, take: 300 });
  }
}

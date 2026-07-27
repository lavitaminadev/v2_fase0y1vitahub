import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChargeNote } from '../charge-note.entity';

@Injectable()
export class ListChargeNotesUseCase {
  constructor(
    @InjectRepository(ChargeNote) private readonly repo: Repository<ChargeNote>,
  ) {}

  execute(organizationId: string): Promise<ChargeNote[]> {
    return this.repo.find({ where: { organizationId }, order: { createdAt: 'DESC' }, take: 300 });
  }
}

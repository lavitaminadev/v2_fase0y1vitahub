import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChargeNote } from '../charge-note.entity';

@Injectable()
export class PriceChargeNoteUseCase {
  constructor(
    @InjectRepository(ChargeNote) private readonly repo: Repository<ChargeNote>,
  ) {}

  async execute(id: string, organizationId: string, amount: number): Promise<ChargeNote> {
    const note = await this.repo.findOne({ where: { id, organizationId } });
    if (!note) throw new NotFoundException('Charge note not found');
    note.amount = amount;
    note.status = 'ready_to_invoice';
    return this.repo.save(note);
  }
}

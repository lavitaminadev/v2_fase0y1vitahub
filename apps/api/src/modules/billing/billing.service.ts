import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ChargeNote } from './charge-note.entity';

@Injectable()
export class BillingService {
  constructor(@InjectRepository(ChargeNote) private readonly chargeNotes: Repository<ChargeNote>) {}

  createCorrectionCharge(params: {
    organizationId: string;
    clientId: string;
    pieceId: string;
    correctionId: string;
    correctionNumber: number;
    createdBy?: string;
  }, manager?: EntityManager): Promise<ChargeNote> {
    const repo = manager?.getRepository(ChargeNote) ?? this.chargeNotes;
    return repo.save(repo.create({
      ...params,
      status: 'pending_pricing',
      reason: `Correccion de cliente numero ${params.correctionNumber}; supera las 3 rondas incluidas.`,
    }));
  }

  listChargeNotes(organizationId: string): Promise<ChargeNote[]> {
    return this.chargeNotes.find({ where: { organizationId }, order: { createdAt: 'DESC' } });
  }

  async priceChargeNote(id: string, organizationId: string, amount: number): Promise<ChargeNote> {
    const note = await this.chargeNotes.findOne({ where: { id, organizationId } });
    if (!note) throw new NotFoundException('Charge note not found');
    note.amount = amount;
    note.status = 'ready_to_invoice';
    return this.chargeNotes.save(note);
  }
}

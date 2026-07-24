import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ChargeNote } from './charge-note.entity';

/**
 * Cross-module entry point for creating correction charge notes.
 * Consumed by production-workflow.service.ts and piece-rejected.handler.ts.
 */
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
}

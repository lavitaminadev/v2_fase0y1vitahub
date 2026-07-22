import { Injectable } from '@nestjs/common';
import { LeadIntakeService } from '../lead-intake.service';

@Injectable()
export class CreateLeadUseCase {
  constructor(
    private readonly leadIntake: LeadIntakeService,
  ) {}

  async execute(data: {
    organizationId: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    source?: string;
    sourceDetail?: string;
    notes?: string;
  }) {
    return this.leadIntake.captureLead(data);
  }
}

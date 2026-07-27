import { Injectable } from '@nestjs/common';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';

@Injectable()
export class PieceRulesService {
  private readonly defaultMaxCorrections = 3;

  constructor(private readonly parameters?: ParameterResolver) {}

  async canRequestCorrection(
    currentCount: number,
    isDesignerError: boolean,
    organizationId?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const maxCorrections = await this.resolveMaxCorrections(organizationId);
    if (!isDesignerError && currentCount >= maxCorrections) {
      return { allowed: true, reason: `La corrección supera las ${maxCorrections} rondas incluidas y será cobrable.` };
    }
    return { allowed: true };
  }

  async shouldGenerateInvoice(clientCorrectionCount: number, organizationId?: string): Promise<boolean> {
    return clientCorrectionCount > await this.resolveMaxCorrections(organizationId);
  }

  private async resolveMaxCorrections(organizationId?: string): Promise<number> {
    if (!this.parameters || !organizationId) return this.defaultMaxCorrections;
    const configured = await this.parameters.get('production.max_client_corrections', null, null, organizationId);
    return Number(configured ?? this.defaultMaxCorrections);
  }
}

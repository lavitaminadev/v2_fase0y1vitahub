import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetOrCreateBudgetUseCase } from './get-or-create-budget.use-case';
import { ReserveUdUseCase } from './reserve-ud.use-case';
import { ConfirmUdConsumptionUseCase } from './confirm-ud-consumption.use-case';
import { GetOrCreateBudgetDto } from './dto/get-or-create-budget.dto';
import { ReserveUdDto } from './dto/reserve-ud.dto';
import { ConfirmUdDto } from './dto/confirm-ud.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountAccessService } from '../../core/client-scope/account-access.service';

@ApiTags('Presupuesto UD')
@Controller('design-budget')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class DesignBudgetController {
  constructor(
    private getOrCreate: GetOrCreateBudgetUseCase,
    private reserve: ReserveUdUseCase,
    private confirm: ConfirmUdConsumptionUseCase,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post('budget')
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtener o crear presupuesto UD del mes' })
  async getOrCreateBudget(@Body() dto: GetOrCreateBudgetDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.getOrCreate.execute(req.organizationId, dto.clientId, dto.year, dto.month, dto.defaultBudget);
  }

  @Post('reserve')
  @Roles(UserRole.ART_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reservar UDs para una pieza' })
  async reserveUd(@Body() dto: ReserveUdDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.reserve.execute(req.organizationId, dto.clientId, dto.pieceId, dto.amount, dto.year, dto.month);
  }

  @Post('confirm')
  @Roles(UserRole.ART_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirmar consumo de UDs' })
  async confirmUd(@Body() dto: ConfirmUdDto, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
    return this.confirm.execute(req.organizationId, dto.clientId, dto.pieceId, dto.year, dto.month);
  }
}

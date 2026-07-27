import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { Correction } from './correction.entity';
import { ProductionController } from './production.controller';
import { AssignPieceUseCase } from './assign-piece.use-case';
import { SubmitVersionUseCase } from './submit-version.use-case';
import { RejectPieceUseCase } from './reject-piece.use-case';
import { DeliverPieceUseCase } from './deliver-piece.use-case';
import { ListPiecesUseCase } from './list-pieces.use-case';
import { PieceRulesService } from './piece-rules.service';
import { ProductionWorkflowService } from './production-workflow.service';
import { DesignBudgetModule } from '../design-budget/design-budget.module';
import { GamificationModule } from '../gamification/gamification.module';
import { ApprovalRequest } from '../approvals/approval-request.entity';
import { BillingModule } from '../billing/billing.module';
import { User } from '../users/user.entity';
import { Client } from '../clients/client.entity';
import { ParametersModule } from '../../core/parameters/parameters.module';

@Module({
  imports: [TypeOrmModule.forFeature([Piece, PieceVersion, Correction, ApprovalRequest, User, Client]), DesignBudgetModule, GamificationModule, BillingModule, ParametersModule],
  controllers: [ProductionController],
  providers: [AssignPieceUseCase, SubmitVersionUseCase, RejectPieceUseCase, DeliverPieceUseCase, ListPiecesUseCase, ProductionWorkflowService, PieceRulesService],
  exports: [TypeOrmModule],
})
export class ProductionModule {}

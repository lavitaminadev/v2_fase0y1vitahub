import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { KnowledgeStore } from './knowledge.store';
import { RagService } from './rag.service';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';

@ApiTags('Knowledge')
@Controller('knowledge')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.AI_LEAD)
export class KnowledgeController {
  constructor(
    private readonly store: KnowledgeStore,
    private readonly rag: RagService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los chunks de conocimiento' })
  list(@Req() req: AuthenticatedRequest) {
    return this.store.getByTenant(req.organizationId ?? req.user.tenantId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas del knowledge base' })
  stats(@Req() req: AuthenticatedRequest) {
    return this.rag.stats(req.organizationId ?? req.user.tenantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Búsqueda semántica en la base de conocimiento' })
  search(@Query('q') query: string, @Req() req: AuthenticatedRequest) {
    return this.rag.semanticSearch(req.organizationId ?? req.user.tenantId, query);
  }
}

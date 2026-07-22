import { Controller, Get, Delete, Post, Body, Req, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DataProtectionService } from './data-protection.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { AuthenticatedRequest, AuthUser } from '../../shared/types/request';
import { RecordConsentDto } from './dto/record-consent.dto';

@ApiTags('Proteccion de Datos')
@Controller('data-protection')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Roles(...Object.values(UserRole))
export class DataProtectionController {
  constructor(private service: DataProtectionService) {}

  @Get('export')
  @ApiOperation({ summary: 'Exportar mis datos personales (Ley 19.628)' })
  async exportMyData(@CurrentUser() user: AuthUser) {
    return this.service.exportUserData(user.id);
  }

  @Delete('anonymize')
  @ApiOperation({ summary: 'Anonimizar mis datos personales' })
  async anonymizeMe(@CurrentUser() user: AuthUser) {
    await this.service.anonymizeUser(user.id);
    return { message: 'Datos anonimizados correctamente' };
  }

  @Post('consent')
  @ApiOperation({ summary: 'Registrar consentimiento de datos' })
  async recordConsent(@CurrentUser() user: AuthUser, @Body() body: RecordConsentDto, @Req() req: AuthenticatedRequest) {
    return this.service.recordConsent(user.id, body.action, body.granted, req.ip);
  }

  @Get('leads/:id/export')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  @ApiOperation({ summary: 'Exportar datos de un lead para revision o cumplimiento' })
  async exportLeadData(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.exportLeadData(id, req.organizationId);
  }

  @Delete('leads/:id/anonymize')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR)
  @ApiOperation({ summary: 'Anonimizar un lead individual' })
  async anonymizeLead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.anonymizeLead(id, req.organizationId, 'Solicitud manual de anonimizacion');
  }
}

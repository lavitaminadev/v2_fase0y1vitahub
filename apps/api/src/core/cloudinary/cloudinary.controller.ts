import { Controller, Get, Put, Delete, Body, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CloudinaryConfigDto } from './dto/cloudinary-config.dto';
import { CloudinaryService } from './cloudinary.service';
import { Integration } from '../../modules/integrations/integration.entity';
import { IntegrationProvider } from '../../modules/integrations/integration-provider.enum';
import { IntegrationStatus } from '../../modules/integrations/integration-status.enum';
import { protectSecret } from '../../shared/security/integration-secrets';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

@ApiTags('Cloudinary')
@Controller('cloudinary')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
export class CloudinaryController {
  constructor(
    @InjectRepository(Integration) private readonly integrations: Repository<Integration>,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Obtener configuración de Cloudinary' })
  async getConfig(@Req() req: AuthenticatedRequest) {
    const integration = await this.integrations.findOne({
      where: { organizationId: req.organizationId, provider: IntegrationProvider.CLOUDINARY },
    });
    const cloudName = integration?.config?.cloudName || process.env.CLOUDINARY_CLOUD_NAME || '';
    const apiKey = integration?.config?.apiKey || process.env.CLOUDINARY_API_KEY || '';
    const hasEnvironmentConfig = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    const connected = await this.cloudinary.isEnabled(req.organizationId);
    return {
      connected,
      cloudName,
      apiKey: apiKey ? `${apiKey.slice(0, 4)}${'*'.repeat(Math.max(apiKey.length - 4, 4))}` : '',
      hasApiKey: Boolean(apiKey),
      hasApiSecret: connected,
      source: integration ? 'integration' : hasEnvironmentConfig ? 'environment' : 'none',
    };
  }

  @Put('config')
  @ApiOperation({ summary: 'Guardar configuración de Cloudinary' })
  async saveConfig(@Req() req: AuthenticatedRequest, @Body() dto: CloudinaryConfigDto) {
    const current = await this.cloudinary.getCredentials(req.organizationId);
    const cloudName = dto.cloudName?.trim() || current?.cloudName || '';
    const apiKey = dto.apiKey?.trim() || current?.apiKey || '';
    const apiSecret = dto.apiSecret?.trim() || current?.apiSecret || '';
    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException('Cloud name, API key y API secret son obligatorios');
    }
    await this.cloudinary.validateCredentials({ cloudName, apiKey, apiSecret });

    const existing = await this.integrations.findOne({
      where: { organizationId: req.organizationId, provider: IntegrationProvider.CLOUDINARY },
    });

    const config = {
      cloudName,
      apiKey,
      apiSecret: protectSecret(apiSecret),
    };

    if (existing) {
      existing.config = config;
      existing.status = IntegrationStatus.ACTIVE;
      await this.integrations.save(existing);
    } else {
      await this.integrations.save(this.integrations.create({
        organizationId: req.organizationId,
        provider: IntegrationProvider.CLOUDINARY,
        name: 'Cloudinary',
        status: IntegrationStatus.ACTIVE,
        config,
      }));
    }

    return { connected: true, cloudName: config.cloudName, apiKey: `${config.apiKey.slice(0, 4)}****`, source: 'integration' };
  }

  @Delete('config')
  @ApiOperation({ summary: 'Eliminar configuración de Cloudinary' })
  async deleteConfig(@Req() req: AuthenticatedRequest) {
    const integration = await this.integrations.findOne({
      where: { organizationId: req.organizationId, provider: IntegrationProvider.CLOUDINARY },
    });
    if (integration) {
      await this.integrations.remove(integration);
    }
    return { connected: false };
  }

  @Get('resources')
  @ApiOperation({ summary: 'Listar recursos de Cloudinary' })
  async listResources(
    @Req() req: AuthenticatedRequest,
    @Query('next') next?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cloudinary.listResources(req.organizationId, {
      maxResults: limit ? Math.min(Number(limit) || 30, 100) : 30,
      nextCursor: next,
    });
  }
}

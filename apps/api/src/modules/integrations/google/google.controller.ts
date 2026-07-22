import { Controller, Get, Post, Body, Query, UseGuards, Req, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GoogleOAuthService } from './google-oauth.service';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '../../../shared/types/request';
import { GoogleOAuthCallbackDto } from './dto/google-oauth-callback.dto';
import { createOAuthState, verifyOAuthState } from '../../../shared/security/oauth-state';
import { toIntegrationResponse } from '../integration-response';
import { GoogleDataService } from './google-data.service';
import { Throttle } from '@nestjs/throttler';
import { RegisterAnalyticsPropertyDto } from './dto/register-analytics-property.dto';
import { resolveOAuthRedirect } from '../../../shared/security/oauth-redirect';

@ApiTags('Google Integrations')
@Controller('integrations/google')
@UseGuards(AuthGuard('jwt'))
export class GoogleController {
  constructor(private readonly oauth: GoogleOAuthService, private readonly data: GoogleDataService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get Google OAuth authorization URL' })
  @Roles(UserRole.ADMIN)
  getAuthUrl(@Req() req: AuthenticatedRequest, @Query('redirect_uri') redirectUri?: string) {
    const uri = resolveOAuthRedirect('google', redirectUri);
    const state = createOAuthState('google', req.organizationId, uri);
    return { url: this.oauth.getAuthorizationUrl(uri, state) };
  }

  @Get('status')
  @ApiOperation({ summary: 'Check Google integration configuration status' })
  @Roles(UserRole.ADMIN)
  getStatus() {
    return {
      configured: this.oauth.isConfigured(),
      clientId: this.oauth.getClientId() || null,
      adsConfigured: Boolean(process.env.GOOGLE_DEVELOPER_TOKEN),
      adsApiVersion: process.env.GOOGLE_ADS_API_VERSION?.trim() || 'v24',
    };
  }

  @Post('callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @Roles(UserRole.ADMIN)
  handleCallback(
    @Body() body: GoogleOAuthCallbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const redirectUri = resolveOAuthRedirect('google', body.redirectUri);
    verifyOAuthState(body.state, { provider: 'google', organizationId: req.organizationId, redirectUri });
    return this.oauth.connectWithCode(req.organizationId, body.code, redirectUri).then(toIntegrationResponse);
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Refresh Google OAuth access token' })
  @Roles(UserRole.ADMIN)
  refresh(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.oauth.refreshIntegration(id, req.organizationId).then(toIntegrationResponse);
  }

  @Post(':id/disconnect')
  @ApiOperation({ summary: 'Revoke Google access and clear local credentials' })
  @Roles(UserRole.ADMIN)
  disconnect(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.oauth.disconnectIntegration(id, req.organizationId).then(toIntegrationResponse);
  }

  @Get(':id/accounts')
  @Roles(UserRole.ADMIN)
  listAccounts(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.data.listAccounts(id, req.organizationId!);
  }

  @Post(':id/ads/discover')
  @Roles(UserRole.ADMIN)
  discoverAds(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.data.discoverAdsAccounts(id, req.organizationId!); }

  @Post(':id/analytics-properties')
  @Roles(UserRole.ADMIN)
  registerAnalytics(@Param('id') id: string, @Body() dto: RegisterAnalyticsPropertyDto, @Req() req: AuthenticatedRequest) { return this.data.registerAnalyticsProperty(id, req.organizationId!, dto.propertyId, dto.name, dto.clientId); }

  @Post(':id/data/sync')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  syncData(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.data.sync(id, req.organizationId!); }
}

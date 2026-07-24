import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { VitaminaPulseService } from './vitamina-pulse.service';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { MonthlyReportsService } from './monthly-reports.service';
import { GenerateMonthlyReportDto, UpdateMonthlyReportDto } from './dto/monthly-report.dto';

interface PieceCountRow { status: string; count: number | string }
interface MonthlyReportRow { month: string; revenue: number | string; ud: number | string }
interface TopClientRow { name: string; revenue: number | string }
interface PerformanceRow {
  provider: string;
  spend: number | string;
  impressions: number | string;
  reach: number | string;
  clicks: number | string;
  leads: number | string;
  conversions: number | string;
  lastDataAt?: string;
}

@ApiTags('Reportes')
@Controller('reporting')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ReportingController {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private readonly pulseService: VitaminaPulseService,
    private readonly accountAccess: AccountAccessService,
    private readonly monthlyReports: MonthlyReportsService,
  ) {}

  private resolveClientScope(req: AuthenticatedRequest): string | null {
    if (req.user?.role !== UserRole.CLIENT) return null;
    if (!req.user.clientId) {
      throw new ForbiddenException('El usuario cliente no tiene una cuenta asociada');
    }
    return req.user.clientId;
  }

  @Get('pulse')
  @Roles(
    UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.CREATIVE_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR,
    UserRole.AI_LEAD, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT,
  )
  @ApiOperation({ summary: 'Pulso Vitamina explicable de la operación y la marca' })
  async pulse(@Req() req: AuthenticatedRequest) {
    const clientId = this.resolveClientScope(req) ?? undefined;
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    return this.pulseService.getPulse(req.organizationId!, clientId, clientIds);
  }

  @Get('dashboard')
  @Roles(
    UserRole.ADMIN,
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.CREATIVE_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR,
    UserRole.ART_DIRECTOR,
    UserRole.AV_DIRECTOR,
    UserRole.AI_LEAD,
    UserRole.COMMUNITY_MANAGER,
    UserRole.DESIGNER,
    UserRole.AUDIOVISUAL,
  )
  @ApiOperation({ summary: 'Dashboard ejecutivo' })
  async dashboard(@Req() req: AuthenticatedRequest) {
    const orgId = req.organizationId!;
    const personal = [UserRole.DESIGNER, UserRole.AUDIOVISUAL].includes(req.user.role as UserRole);
    const clientIds = await this.accountAccess.allowedClientIds(orgId, req.user);
    const clientScope = clientIds === undefined
      ? { sql: '', params: [] as string[] }
      : clientIds.length
        ? { sql: ` AND client_id IN (${clientIds.map(() => '?').join(',')})`, params: clientIds }
        : { sql: ' AND 1 = 0', params: [] as string[] };
    const clientRowScope = clientIds === undefined
      ? { sql: '', params: [] as string[] }
      : clientIds.length
        ? { sql: ` AND id IN (${clientIds.map(() => '?').join(',')})`, params: clientIds }
        : { sql: ' AND 1 = 0', params: [] as string[] };

    const [clientRow] = personal ? [{ total: 0 }] : await this.dataSource.query(
      `SELECT COUNT(*) as total FROM clients WHERE organization_id = ?${clientRowScope.sql} AND status = 'active'`,
      [orgId, ...clientRowScope.params],
    );
    const pieceRows = await this.dataSource.query<PieceCountRow[]>(
      `SELECT status, COUNT(*) as count FROM pieces WHERE organization_id = ?${personal ? ' AND assigned_to = ?' : clientScope.sql} GROUP BY status`,
      personal ? [orgId, req.user.id] : [orgId, ...clientScope.params],
    );
    const [xpRow] = await this.dataSource.query(
      `SELECT COALESCE(SUM(points),0) as total FROM xp_events WHERE ${personal || req.user.role === UserRole.COMMUNITY_MANAGER ? 'user_id = ?' : 'user_id IN (SELECT id FROM users WHERE organization_id = ?)'} AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`,
      [personal || req.user.role === UserRole.COMMUNITY_MANAGER ? req.user.id : orgId],
    );
    const [udRow] = personal ? [{ contracted: 0, consumed: 0, reserved: 0 }] : await this.dataSource.query(
      `SELECT COALESCE(SUM(contracted),0) as contracted, COALESCE(SUM(consumed),0) as consumed, COALESCE(SUM(reserved),0) as reserved FROM ud_budgets WHERE client_id IN (SELECT id FROM clients WHERE organization_id = ?${clientRowScope.sql})`,
      [orgId, ...clientRowScope.params],
    );

    const pendingPieces = pieceRows.reduce(
      (sum, piece) => (piece.status !== 'delivered' && piece.status !== 'cancelled' ? sum + Number(piece.count) : sum),
      0,
    );
    const pieces = pieceRows.map((piece) => ({
      status: piece.status,
      count: Number(piece.count),
    }));

    return {
      activeClients: Number(clientRow?.total || 0),
      pendingPieces,
      teamXp: Number(xpRow?.total || 0),
      monthUd: Number(udRow?.consumed || 0),
      ud: {
        contracted: Number(udRow?.contracted || 0),
        consumed: Number(udRow?.consumed || 0),
        reserved: Number(udRow?.reserved || 0),
      },
      pieces,
    };
  }

  @Get('reports')
  @Roles(
    UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.CREATIVE_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR,
    UserRole.AI_LEAD, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT,
  )
  @ApiOperation({ summary: 'Reportes generales' })
  async reports(@Req() req: AuthenticatedRequest) {
    const orgId = req.organizationId;
    const clientId = this.resolveClientScope(req);
    const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    const invoiceConditions = ['organization_id = ?'];
    const invoiceParams: string[] = [orgId];
    const pieceConditions = ['organization_id = ?'];
    const pieceParams: string[] = [orgId];
    const clientConditions = ['organization_id = ?'];
    const clientParams: string[] = [orgId];

    if (clientId) {
      invoiceConditions.push('client_id = ?');
      invoiceParams.push(clientId);
      pieceConditions.push('client_id = ?');
      pieceParams.push(clientId);
      clientConditions.push('id = ?');
      clientParams.push(clientId);
    } else if (allowedClientIds !== undefined) {
      const scopedCondition = allowedClientIds.length
        ? `client_id IN (${allowedClientIds.map(() => '?').join(',')})`
        : '1 = 0';
      const scopedClientCondition = allowedClientIds.length
        ? `id IN (${allowedClientIds.map(() => '?').join(',')})`
        : '1 = 0';
      invoiceConditions.push(scopedCondition);
      invoiceParams.push(...allowedClientIds);
      pieceConditions.push(scopedCondition);
      pieceParams.push(...allowedClientIds);
      clientConditions.push(scopedClientCondition);
      clientParams.push(...allowedClientIds);
    }

    const topConditions = ['c.organization_id = ?'];
    const topParams = [orgId];
    if (clientId) {
      topConditions.push('c.id = ?');
      topParams.push(clientId);
    } else if (allowedClientIds !== undefined) {
      topConditions.push(allowedClientIds.length
        ? `c.id IN (${allowedClientIds.map(() => '?').join(',')})`
        : '1 = 0');
      topParams.push(...allowedClientIds);
    }

    const [[revRow], [projRow], [avgUdRow], monthlyRows, topRows] = await Promise.all([
      this.dataSource.query(
        `SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE ${invoiceConditions.join(' AND ')} AND status = 'paid'`,
        invoiceParams,
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as total FROM pieces WHERE ${pieceConditions.join(' AND ')} AND status NOT IN ('delivered','cancelled')`,
        pieceParams,
      ),
      this.dataSource.query(
        `SELECT COALESCE(AVG(default_ud_budget),0) as avg FROM clients WHERE ${clientConditions.join(' AND ')}`,
        clientParams,
      ),
      this.dataSource.query<MonthlyReportRow[]>(
        `SELECT months.month,
                COALESCE(revenue.total, 0) AS revenue,
                COALESCE(production.ud, 0) AS ud
         FROM (
           SELECT DATE_FORMAT(created_at, '%Y-%m') AS month FROM invoices
            WHERE ${invoiceConditions.join(' AND ')} AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
           UNION
           SELECT DATE_FORMAT(created_at, '%Y-%m') AS month FROM pieces
            WHERE ${pieceConditions.join(' AND ')} AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         ) months
         LEFT JOIN (
           SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total) AS total
           FROM invoices WHERE ${invoiceConditions.join(' AND ')} AND status = 'paid'
           GROUP BY month
         ) revenue ON revenue.month = months.month
         LEFT JOIN (
           SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(ud_amount) AS ud
           FROM pieces WHERE ${pieceConditions.join(' AND ')} GROUP BY month
         ) production ON production.month = months.month
         ORDER BY months.month ASC`,
        [...invoiceParams, ...pieceParams, ...invoiceParams, ...pieceParams],
      ),
      this.dataSource.query<TopClientRow[]>(
        `SELECT c.name, COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END),0) as revenue
         FROM clients c LEFT JOIN invoices i ON i.client_id = c.id
         WHERE ${topConditions.join(' AND ')}
         GROUP BY c.id ORDER BY revenue DESC LIMIT 5`,
        topParams,
      ),
    ]);
    const monthly = monthlyRows.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      ud: Number(r.ud),
    }));

    return {
      totalRevenue: Number(revRow?.total || 0),
      activeProjects: Number(projRow?.total || 0),
      avgUdPerClient: Math.round(Number(avgUdRow?.avg || 0)),
      monthlyData: monthly,
      topClients: topRows.map((row) => ({ name: row.name, revenue: Number(row.revenue) })),
    };
  }

  @Get('kpi')
  @Roles(
    UserRole.ADMIN,
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.CREATIVE_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR,
    UserRole.ART_DIRECTOR,
    UserRole.AV_DIRECTOR,
    UserRole.AI_LEAD,
  )
  @ApiOperation({ summary: 'KPIs estrategicos para direccion' })
  async kpi(@Req() req: AuthenticatedRequest) {
    const orgId = req.organizationId;

    const [revRow] = await this.dataSource.query(
      `SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE organization_id = ? AND status = 'paid' AND YEAR(created_at) = YEAR(NOW())`,
      [orgId],
    );
    const [clientRow] = await this.dataSource.query(
      `SELECT COUNT(*) as total FROM clients WHERE organization_id = ? AND status = 'active'`,
      [orgId],
    );
    const [udRow] = await this.dataSource.query(
      `SELECT COALESCE(SUM(contracted),0) as total FROM ud_budgets WHERE client_id IN (SELECT id FROM clients WHERE organization_id = ?)`,
      [orgId],
    );
    const [retRow] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT client_id) * 100.0 / NULLIF((SELECT COUNT(*) FROM clients WHERE organization_id = ?), 0) as pct FROM pieces WHERE organization_id = ? AND status = 'delivered'`,
      [orgId, orgId],
    );

    return {
      revenueYtd: Number(revRow?.total || 0),
      revenueTarget: null,
      activeClients: Number(clientRow?.total || 0),
      clientTarget: null,
      udSold: Number(udRow?.total || 0),
      udTarget: null,
      teamUtilization: null,
      utilizationTarget: null,
      clientRetention: Math.round(Number(retRow?.pct || 0)),
      nps: null,
      growthRate: null,
    };
  }

  @Get('performance')
  @Roles(
    UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.CREATIVE_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR, UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR,
    UserRole.AI_LEAD, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT,
  )
  @ApiOperation({ summary: 'Rendimiento consolidado de Meta Ads, Google Ads y Analytics' })
  async performance(@Req() req: AuthenticatedRequest) {
    const clientId = this.resolveClientScope(req);
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    const conditions = ['organization_id = ?', 'metric_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'];
    const params: string[] = [req.organizationId!];
    if (clientId) { conditions.push('client_id = ?'); params.push(clientId); }
    else if (clientIds !== undefined) {
      conditions.push(clientIds.length ? `client_id IN (${clientIds.map(() => '?').join(',')})` : '1 = 0');
      params.push(...clientIds);
    }
    const rows = await this.dataSource.query<PerformanceRow[]>(
      `SELECT provider,
              SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(reach) AS reach,
              SUM(clicks) AS clicks, SUM(leads) AS leads, SUM(conversions) AS conversions,
              MAX(metric_date) AS lastDataAt
       FROM integration_metrics WHERE ${conditions.join(' AND ')} GROUP BY provider ORDER BY provider`,
      params,
    );
    const providers = rows.map((row) => ({
      provider: row.provider, spend: Number(row.spend), impressions: Number(row.impressions), reach: Number(row.reach),
      clicks: Number(row.clicks), leads: Number(row.leads), conversions: Number(row.conversions), lastDataAt: row.lastDataAt,
    }));
    const totals = providers.reduce((sum, row) => ({
      spend: sum.spend + row.spend, impressions: sum.impressions + row.impressions, reach: sum.reach + row.reach,
      clicks: sum.clicks + row.clicks, leads: sum.leads + row.leads, conversions: sum.conversions + row.conversions,
    }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, conversions: 0 });
    return {
      periodDays: 30, providers, totals,
      derived: {
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
        cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
        ctr: totals.impressions > 0 ? totals.clicks * 100 / totals.impressions : null,
        conversionRate: totals.clicks > 0 ? totals.conversions * 100 / totals.clicks : null,
      },
      hasData: providers.length > 0,
    };
  }

  @Get('monthly-reports')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.CREATIVE_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER, UserRole.CLIENT)
  async listMonthlyReports(@Req() req: AuthenticatedRequest, @Query('year') year?: string, @Query('month') month?: string, @Query('clientId') requestedClientId?: string) {
    const clientId = this.resolveClientScope(req) ?? requestedClientId;
    if (clientId) await this.accountAccess.assertClient(req.organizationId!, req.user, clientId);
    const clientIds = await this.accountAccess.allowedClientIds(req.organizationId!, req.user);
    return this.monthlyReports.list(req.organizationId!, { clientId: clientId ?? undefined, clientIds, clientView: req.user.role === UserRole.CLIENT, year: year ? Number(year) : undefined, month: month ? Number(month) : undefined });
  }

  @Post('monthly-reports/generate')
  @Roles(UserRole.ADMIN, UserRole.CREATIVE_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  async generateMonthlyReport(@Req() req: AuthenticatedRequest, @Body() dto: GenerateMonthlyReportDto) {
    await this.accountAccess.assertClient(req.organizationId!, req.user, dto.clientId);
    return this.monthlyReports.generate(req.organizationId!, req.user.id, dto);
  }

  @Put('monthly-reports/:id')
  @Roles(UserRole.ADMIN, UserRole.CREATIVE_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.COMMUNITY_MANAGER)
  updateMonthlyReport(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateMonthlyReportDto) { return this.monthlyReports.update(id, req.organizationId!, dto); }

  @Post('monthly-reports/:id/publish')
  @Roles(UserRole.ADMIN, UserRole.CREATIVE_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  publishMonthlyReport(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.monthlyReports.setPublished(id, req.organizationId!, req.user.id, true); }

  @Post('monthly-reports/:id/unpublish')
  @Roles(UserRole.ADMIN, UserRole.CREATIVE_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  unpublishMonthlyReport(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.monthlyReports.setPublished(id, req.organizationId!, req.user.id, false); }
}

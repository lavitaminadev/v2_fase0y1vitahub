import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async getOverview(organizationId: string) {
    const [clients] = await this.dataSource.query(
      'SELECT COUNT(*) as total FROM clients WHERE organization_id = ?', [organizationId]);
    const [contracts] = await this.dataSource.query(
      'SELECT COUNT(*) as total FROM contracts WHERE organization_id = ?', [organizationId]);
    const [pieces] = await this.dataSource.query(
      'SELECT COUNT(*) as total FROM pieces WHERE organization_id = ?', [organizationId]);
    const [users] = await this.dataSource.query(
      'SELECT COUNT(*) as total FROM users WHERE organization_id = ?', [organizationId]);
    return {
      clients: clients?.total || 0,
      contracts: contracts?.total || 0,
      pieces: pieces?.total || 0,
      users: users?.total || 0,
    };
  }

  async getProduction(organizationId: string) {
    const pieces = await this.dataSource.query(
      'SELECT status, COUNT(*) as count FROM pieces WHERE organization_id = ? GROUP BY status', [organizationId]);
    const briefs = await this.dataSource.query(
      'SELECT status, COUNT(*) as count FROM briefs WHERE organization_id = ? GROUP BY status', [organizationId]);
    return { pieces, briefs };
  }

  async getFinancial(organizationId: string) {
    const [udStats] = await this.dataSource.query(
      'SELECT COALESCE(SUM(contracted),0) as contracted, COALESCE(SUM(reserved),0) as reserved, COALESCE(SUM(consumed),0) as consumed FROM ud_budgets WHERE client_id IN (SELECT id FROM clients WHERE organization_id = ?)', [organizationId]);
    const [contracts] = await this.dataSource.query(
      'SELECT COUNT(*) as total, COALESCE(SUM(monthly_ud),0) as total_monthly_ud FROM contracts WHERE organization_id = ?', [organizationId]);
    return { ud: udStats, contracts };
  }
}

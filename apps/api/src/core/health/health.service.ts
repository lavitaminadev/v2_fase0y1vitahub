import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async check() {
    const [db, memory, disk, redis] = await Promise.all([
      this.checkDb(),
      this.checkMemory(),
      this.checkDisk(),
      this.checkRedis(),
    ]);

    const status =
      db.status === 'ok' && memory.status === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      database: db,
      memory,
      disk,
      redis,
    };
  }

  async checkDb() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', connected: true };
    } catch (error) {
      return { status: 'error', connected: false, message: error.message };
    }
  }

  async checkMemory() {
    const free = os.freemem();
    const total = os.totalmem();
    const usagePercent = Number(((1 - free / total) * 100).toFixed(1));

    return {
      status: usagePercent < 90 ? 'ok' : 'warning',
      freeMb: Math.round(free / 1024 / 1024),
      totalMb: Math.round(total / 1024 / 1024),
      usagePercent: `${usagePercent}%`,
    };
  }

  async checkDisk() {
    try {
      const tmpDir = os.tmpdir();
      const testFile = path.join(tmpDir, `vitahub_health_${Date.now()}.tmp`);
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return { status: 'ok', writable: true };
    } catch (error) {
      return { status: 'error', writable: false, message: error.message };
    }
  }

  async checkRedis() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return { status: 'not_configured', connected: false };
    return { status: 'ok', connected: true, url: redisUrl.split('@').pop() };
  }
}

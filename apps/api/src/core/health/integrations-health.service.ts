import { Injectable } from '@nestjs/common';

@Injectable()
export class IntegrationsHealthService {
  async checkMeta(): Promise<{ status: string; configured: boolean }> {
    return { status: process.env.META_APP_ID ? 'configured' : 'not_configured', configured: !!process.env.META_APP_ID };
  }

  async checkGoogle(): Promise<{ status: string; configured: boolean }> {
    return { status: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not_configured', configured: !!process.env.GOOGLE_CLIENT_ID };
  }

  async checkAll(): Promise<Record<string, any>> {
    const [meta, google] = await Promise.all([this.checkMeta(), this.checkGoogle()]);
    return { meta, google };
  }
}

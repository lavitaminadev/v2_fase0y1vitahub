import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface MetaPixelInfo { id?: string; name?: string; last_fired_time?: string }
interface MetaPixelStats { data?: Array<Record<string, unknown>> }

@Injectable()
export class MetaPixelService {
  private readonly logger = new Logger(MetaPixelService.name);

  constructor(private readonly http: HttpService) {}

  async validatePixel(pixelId: string, accessToken: string): Promise<boolean> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    try {
      const { data } = await firstValueFrom(
        this.http.get<MetaPixelInfo>(`https://graph.facebook.com/${version}/${pixelId}`, {
          params: { fields: 'id,name,last_fired_time' },
          headers: { authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }),
      );
      return !!data.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Meta pixel validation failed for ${pixelId}: ${message}`);
      return false;
    }
  }

  async getPixelStats(pixelId: string, accessToken: string): Promise<MetaPixelStats | null> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    try {
      const { data } = await firstValueFrom(
        this.http.get<MetaPixelStats>(`https://graph.facebook.com/${version}/${pixelId}/stats`, {
          headers: { authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }),
      );
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Meta pixel stats fetch failed for ${pixelId}: ${message}`);
      return null;
    }
  }
}

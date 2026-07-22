import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MetaPixelService {
  constructor(private readonly http: HttpService) {}

  async validatePixel(pixelId: string, accessToken: string): Promise<boolean> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    try {
      const { data } = await firstValueFrom(
        this.http.get<any>(`https://graph.facebook.com/${version}/${pixelId}`, {
          params: { fields: 'id,name,last_fired_time' },
          headers: { authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }),
      );
      return !!data.id;
    } catch {
      return false;
    }
  }

  async getPixelStats(pixelId: string, accessToken: string): Promise<any> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
    try {
      const { data } = await firstValueFrom(
        this.http.get<any>(`https://graph.facebook.com/${version}/${pixelId}/stats`, {
          headers: { authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }),
      );
      return data;
    } catch {
      return null;
    }
  }
}

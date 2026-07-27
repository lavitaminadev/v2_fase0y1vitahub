import { IsString, IsUrl, MaxLength } from 'class-validator';

export class GoogleOAuthCallbackDto {
  @IsString() @MaxLength(4096) code: string;
  @IsString() @MaxLength(4096) state: string;
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  redirectUri: string;
}

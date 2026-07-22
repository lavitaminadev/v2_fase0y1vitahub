import { IsOptional, IsString } from 'class-validator';

/**
 * Refresh token request body.
 */
export class RefreshDto {
  /** Legacy API clients may still send the token in the body. Browsers use the HttpOnly cookie. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

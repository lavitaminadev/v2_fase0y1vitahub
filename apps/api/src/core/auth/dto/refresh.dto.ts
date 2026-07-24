import { IsOptional, IsString } from 'class-validator';

/**
 * Cuerpo del request de refresh token.
 */
export class RefreshDto {
  /** Clientes de API legacy pueden seguir enviando el token en el body. Los navegadores usan la cookie HttpOnly. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

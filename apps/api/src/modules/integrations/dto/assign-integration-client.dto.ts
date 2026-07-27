import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignIntegrationClientDto {
  @Transform(({ value }) => value === '' || value === null ? undefined : value)
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

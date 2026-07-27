import { IsString, IsEnum, IsOptional, MaxLength, IsObject } from 'class-validator';
import { IntegrationProvider } from '../integration-provider.enum';

export class CreateIntegrationDto {
  @IsEnum(IntegrationProvider) provider: IntegrationProvider;
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

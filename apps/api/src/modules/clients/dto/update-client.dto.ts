import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateClientDto } from './create-client.dto';
import { ClientStatus } from '../client-status.enum';

export class UpdateClientDto extends PartialType(CreateClientDto) {
  @IsOptional() @IsEnum(ClientStatus) status?: ClientStatus;
  @IsOptional() @IsDateString() startedAt?: string;
  @IsOptional() @IsDateString() renewalAt?: string;
  @IsOptional() @IsString() @MaxLength(255) whatsappGroup?: string;
  @IsOptional() @IsString() @MaxLength(255) driveFolderId?: string;
}

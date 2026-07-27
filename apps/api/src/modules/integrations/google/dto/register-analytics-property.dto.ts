import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class RegisterAnalyticsPropertyDto {
  @IsString() @Matches(/^(properties\/)?\d+$/) @MaxLength(80) propertyId: string;
  @IsString() @MaxLength(255) name: string;
  @IsUUID() clientId: string;
}

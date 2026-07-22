import { IsNotEmptyObject, IsObject } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsObject()
  @IsNotEmptyObject()
  values: Record<string, unknown>;
}

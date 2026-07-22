import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export class RecordConsentDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9][a-z0-9_.:-]*$/i)
  action: string;

  @IsBoolean()
  granted: boolean;
}

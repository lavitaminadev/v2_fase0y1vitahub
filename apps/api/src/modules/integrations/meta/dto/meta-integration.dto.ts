import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUrl, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const META_ID = /^\d{1,32}$/;

export class MetaOAuthCallbackDto {
  @IsString()
  @MaxLength(4096)
  code: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  redirectUri: string;

  @IsString()
  @MaxLength(4096)
  state: string;
}

export class MetaLeadSyncDto {
  @IsString()
  @Matches(META_ID)
  pageId: string;

  @IsString()
  @Matches(META_ID)
  leadgenId: string;
}

export class MetaPixelDto {
  @IsString()
  @Matches(META_ID)
  pixelId: string;
}

export class MetaClientPixelDto extends MetaPixelDto {
  @IsUUID() clientId: string;
  @IsOptional() @IsString() @MaxLength(120) pixelName?: string;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(4096) accessToken?: string;
}

export class MetaClientPixelSetupDto {
  @IsUUID() clientId: string;
  @IsIn(['none', 'manual', 'existing']) mode: 'none' | 'manual' | 'existing';
  @IsOptional() @IsString() @Matches(META_ID) pixelId?: string;
  @IsOptional() @IsString() @Matches(META_ID) existingPixelId?: string;
  @IsOptional() @IsString() @MaxLength(120) pixelName?: string;
  @IsOptional() @IsString() @MinLength(20) @MaxLength(4096) accessToken?: string;
}

export class MetaAssetSelectionDto {
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) pageIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) instagramProfileIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) adAccountIds?: string[];
  @IsOptional() @IsString() primaryPageId?: string | null;
  @IsOptional() @IsString() primaryInstagramProfileId?: string | null;
  @IsOptional() @IsString() primaryAdAccountId?: string | null;
}

import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANCY_KEY = 'skip_tenancy';

export const SkipTenancy = () => SetMetadata(SKIP_TENANCY_KEY, true);

import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { MetaModule } from '../../modules/integrations/meta/meta.module';
import { GoogleModule } from '../../modules/integrations/google/google.module';

@Module({
  imports: [MetaModule, GoogleModule],
  controllers: [CronController],
})
export class CronModule {}

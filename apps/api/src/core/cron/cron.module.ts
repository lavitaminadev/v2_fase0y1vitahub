import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { MetaModule } from '../../modules/integrations/meta/meta.module';

@Module({
  imports: [MetaModule],
  controllers: [CronController],
})
export class CronModule {}

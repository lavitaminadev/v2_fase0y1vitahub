import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../modules/clients/client.entity';
import { AccountAccessService } from './account-access.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  providers: [AccountAccessService],
  exports: [AccountAccessService],
})
export class AccountAccessModule {}

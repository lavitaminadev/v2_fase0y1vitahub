import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../../modules/clients/client.entity';
import { PodMember } from '../../modules/pods/pod-member.entity';
import { AccountAccessService } from './account-access.service';
import { UserClientAccess } from './user-client-access.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Client, PodMember, UserClientAccess])],
  providers: [AccountAccessService],
  exports: [AccountAccessService],
})
export class AccountAccessModule {}

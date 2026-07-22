import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MetaController } from "./meta.controller";
import { MetaService } from "./meta.service";
import { MetaPixelService } from "./meta-pixel.service";
import { MetaConversionsService } from "./meta-conversions.service";
import { MetaPixelController } from "./meta-pixel.controller";
import { MetaOAuthService } from "./meta-oauth.service";
import { Integration } from "../integration.entity";
import { IntegrationAccount } from "../integration-account.entity";
import { CrmModule } from "../../crm/crm.module";
import { MetaLeadAdsService } from "./meta-lead-ads.service";
import { MetaLeadWebhookEvent } from "./meta-lead-webhook-event.entity";
import { LeadConvertedHandler } from "./handlers/lead-converted.handler";
import { Lead } from "../../crm/leads/lead.entity";
import { Client } from "../../clients/client.entity";
import { MetaConversionOutbox } from "./meta-conversion-outbox.entity";
import { MetaConversionOutboxService } from "./meta-conversion-outbox.service";
import { IntegrationMetric } from "../integration-metric.entity";
import { MetaInsightsService } from "./meta-insights.service";
import { MetaClientPixelService } from "./meta-client-pixel.service";

@Module({
  imports: [HttpModule, CrmModule, TypeOrmModule.forFeature([Integration, IntegrationAccount, IntegrationMetric, MetaLeadWebhookEvent, MetaConversionOutbox, Lead, Client])],
  controllers: [MetaController, MetaPixelController],
  providers: [MetaService, MetaPixelService, MetaClientPixelService, MetaConversionsService, MetaConversionOutboxService, MetaInsightsService, MetaOAuthService, MetaLeadAdsService, LeadConvertedHandler],
  exports: [MetaService, MetaPixelService, MetaClientPixelService, MetaConversionsService, MetaConversionOutboxService, MetaOAuthService, MetaLeadAdsService],
})
export class MetaModule {}

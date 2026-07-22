# Meta Status

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-17`
FUENTE: auditoria sobre codigo local y pruebas ejecutadas

| Componente | Implementado | Probado local | Probado con Meta real | Operativo produccion | Pendiente | Evidencia |
|---|---|---|---|---|---|---|
| OAuth | Si | Si | No | No confirmado | Validacion con app real | `MetaPixelController`, `MetaOAuthService`, `oauth-state.spec.ts` |
| Token storage | Si | Si | No | No confirmado | Verificar secretos reales y rotacion | `protectSecret`, `revealSecret`, `credentialsEncrypted` |
| Token refresh/reconnect | Si | Parcial | No | No confirmado | Ejecutar refresh con token real | `refreshIntegration()` |
| Pages | Si | Si | No | No confirmado | Descubrimiento real | `discoverAssets()` |
| Instagram | Si | Si | No | No confirmado | Cuenta conectada real | `connected_instagram_account` |
| Ad Accounts | Si | Si | No | No confirmado | Cuenta publicitaria real | `discoverAssets()` |
| Lead Forms | Parcial | No | No | No confirmado | Descubrimiento/uso real de forms | solo llega `form_id` desde lead detail |
| Webhook verification | Si | Parcial | No | No confirmado | Prueba externa firmada | `MetaController`, `meta-webhook-access.spec.ts` |
| Webhook Leadgen | Si | Si | No | No confirmado | Probar con page real | `MetaLeadAdsService` |
| Historical Sync | Parcial | Si | No | No confirmado | definir alcance y paginacion real | `POST /integrations/meta/leads/sync` es sync puntual, no historico completo |
| Deduplication | Si | Si | No | No confirmado | Validar migracion en staging | `LeadIntakeService`, `UQ_leads_org_external` |
| Campaign attribution | Si | Si | No | No confirmado | verificar datos reales de campañas | `campaign_id`, `campaign_name`, `ad_id`, `adset_id` |
| CAPI | Si | Si | No | No confirmado | Prueba con pixel real | `MetaConversionsService`, `MetaConversionOutboxService` |
| Retries | Si | Si | No | No confirmado | Validar cron en hosting | outbox persistente, espera incremental y limite de intentos |
| Monitoring | Parcial | Si | No | No confirmado | tablero operacional y alertas | `MetaLeadWebhookEvent`, `health` endpoint |

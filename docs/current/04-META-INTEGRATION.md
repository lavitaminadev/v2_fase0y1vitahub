# Meta Integration

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-17`
FUENTE: codigo actual de `apps/api` y `apps/web`

## Inventario Verificado

### Frontend

- `apps/web/src/features/integrations/MetaConnectCard.tsx`
- `apps/web/src/features/integrations/OAuthCallbackPage.tsx`
- `apps/web/src/features/integrations/IntegrationsPage.tsx`

### Backend

- `MetaPixelController`
- `MetaController`
- `MetaOAuthService`
- `MetaLeadAdsService`
- `MetaConversionsService`
- `lead-converted.handler.ts`

### Persistencia

- `Integration`
- `IntegrationAccount`
- `MetaLeadWebhookEvent`

## Flujo OAuth Real

1. Frontend pide `GET /integrations/meta/auth-url?redirect_uri=...`
2. Backend genera `state` firmado con `createOAuthState('meta', organizationId, redirectUri)`
3. Usuario autoriza en Meta
4. `OAuthCallbackPage` recibe `code` y `state`
5. Frontend hace `POST /integrations/meta/callback`
6. Backend verifica:
   - proveedor
   - organizacion
   - redirect URI
   - expiracion
   - firma HMAC
7. Backend intercambia `code`
8. Backend intenta long-lived token
9. Backend obtiene `metaUserId`
10. Backend guarda integracion activa con token protegido

## Estado de Seguridad OAuth

- `state` con expiracion de 10 minutos: SI
- firma HMAC: SI
- binding a organizacion: SI
- binding a redirect URI: SI
- rechazo de `state` invalido: SI, con test
- exposicion de token en frontend: NO observada

## Descubrimiento y Seleccion de Activos

### Activos descubiertos

- Paginas
- Perfiles de Instagram conectados a paginas
- Cuentas publicitarias

### Lo que SI hace hoy

- Persiste activos en `integration_accounts`
- Protege access token de pagina
- Permite marcar seleccionados
- Persiste `primaryPageId`, `primaryInstagramProfileId`, `primaryAdAccountId`
- Suscribe paginas seleccionadas a `subscribed_apps`

### Lo que NO quedo probado con Meta real en esta iteracion

- exito real de `subscribed_apps`
- disponibilidad de formularios Lead Ads por cuenta real
- health exacto con permisos efectivamente concedidos por una app viva

## Webhook y Lead Ads

### Flujo real actual

1. `GET /api/webhooks/meta` verifica challenge.
2. `POST /api/webhooks/meta` verifica firma.
3. Se normaliza payload general Meta.
4. `MetaLeadAdsService` extrae cambios `leadgen`.
5. Se registra `MetaLeadWebhookEvent`.
6. Se busca pagina Meta relacionada.
7. Se descarga detalle del lead desde Graph API.
8. Se normaliza `field_data`.
9. Se envía a `LeadIntakeService.captureLead()`.
10. Se actualiza `MetaLeadWebhookEvent` con estado y payload normalizado.

### Correcciones realizadas en esta fase

- La sincronizacion manual ahora queda atada al `organizationId` autenticado.
- Las paginas no seleccionadas ya no pueden disparar captura efectiva de leads.
- Se agregaron pruebas para ambos casos.

## CAPI Real

### Lo que existe

- validacion de pixel por `POST /integrations/meta/:id/pixel/validate`
- guardado de `pixelId` en configuracion de integracion
- envio de test event por `POST /integrations/meta/:id/conversions/test`
- handler de conversion comercial que intenta enviar evento `Lead` con datos hasheados

### Lo que se corrigio

- el handler ya no depende de un `IntegrationAccountType.PIXEL` inexistente;
- ahora resuelve `pixelId` desde la integracion real y usa cuenta `PAGE`.

### Durabilidad implementada

- existe outbox persistente `meta_conversion_outbox` con unicidad por organizacion y `eventId`;
- los envios fallidos se reintentan con espera incremental y limite de ocho intentos;
- el scheduler procesa la cola cada cinco minutos cuando `ENABLE_INTERNAL_SCHEDULER=true`;
- en cPanel tambien puede ejecutarse mediante cron, segun la configuracion de hosting.

## Hallazgos Que Faltaban En El Informe No Adjuntado

- Faltaba registrar la ausencia de `GET /crm/leads/:id`.
- Faltaba registrar que `syncLead()` no quedaba vinculado a la organizacion autenticada.
- Faltaba registrar que el webhook aceptaba paginas descubiertas aunque no estuvieran seleccionadas para operacion.
- Faltaba registrar que el flujo CAPI estaba desalineado con el modelo de cuentas real y referenciaba un tipo inexistente.
- Faltaba separar claramente “implementado en codigo” de “validado con Meta real”.

## Validaciones Externas Pendientes

- prueba real de OAuth con credenciales Meta validas;
- prueba real de webhook `leadgen`;
- prueba real de `subscribeSelectedPages`;
- prueba real de CAPI con pixel y token de produccion;
- validacion de permisos, renovacion de credenciales y cron en iHosting.

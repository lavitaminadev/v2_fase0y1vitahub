# CRM

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-17`
FUENTE: codigo actual de `apps/api` y `apps/web`

## Inventario Verificado

- Entidad principal: `Lead`
- Modulos expuestos: leads, contacts, opportunities, interactions
- Pantallas web verificadas: `LeadsPage`, drawer de detalle, vistas de oportunidades/interacciones disponibles por codigo

## Flujo Real de Entrada de Lead

1. Entra por `LeadIntakeService.captureLead()`.
2. Se normalizan nombre, email, telefono, company, source y notas.
3. Se busca duplicado por este orden:
   - `externalLeadId`
   - `email`
   - `phone`
4. Se califica el lead:
   - puntaje por email, telefono, company, fuente Meta y contexto de campaña;
   - descarte por palabras de baja calidad o ausencia de canal de contacto;
   - clasificacion en `qualified`, `review` o `discarded`.
5. Se persiste o actualiza el lead.
6. Se ejecuta `CrmLeadAutomationService`.

## Trazabilidad Real Conservada En Lead

- `organizationId`
- `source`
- `sourceDetail`
- `externalLeadId`
- `externalFormId`
- `externalCampaignId`
- `campaignName`
- `pageId`
- `fitStatus`
- `qualityScore`
- `discardReason`
- `assignedTo`
- `consentCapturedAt`
- `retentionReviewAt`
- `metadata`
- `convertedAt`
- `convertedToClientId`

## Endpoints CRM Verificados

- `POST /crm/leads`
- `GET /crm/leads`
- `GET /crm/leads/:id`
- `PUT /crm/leads/:id`
- `POST /crm/leads/:id/convert`

## Hallazgos

- Hallazgo corregido: la UI de detalle de lead ya existia pero el endpoint `GET /crm/leads/:id` no.
- La deduplicacion actual privilegia seguridad operativa sobre agresividad: si coincide `externalLeadId`, `email` o `phone`, se actualiza el lead existente.
- La deduplicacion por `externalLeadId` esta reforzada por el indice unico `UQ_leads_org_external` sobre `organization_id + external_lead_id`.
- La conversion a cliente usa transaccion, bloqueo pesimista y rechazo explicito de una segunda conversion; el evento se emite solo despues del commit.

## Limite de Verificacion Externa

- La suite automatizada prueba la repeticion de `lead -> client` y confirma que no crea un segundo cliente.
- La interfaz de acceso se verifico en navegador real, escritorio y movil, sin errores de consola ni overflow.
- La navegacion CRM autenticada con datos persistidos requiere MySQL de staging; es una validacion de despliegue, no un error conocido del codigo.

## Estado de Veracidad Frente al Documento Maestro

- Es verdadero que el CRM existe y tiene estructura real de pipeline comercial.
- El ciclo `lead -> cliente` esta probado localmente; la reporteria completa con datos reales debe validarse en staging.
- El sistema si conserva atribucion basica de origen de lead, pero no toda la reporteria de ROI que el Maestro proyecta como objetivo final.

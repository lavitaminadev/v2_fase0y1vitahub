# Base de Datos VITAHUB

Motor actual: **MySQL 8**
ORM: **TypeORM**

## Criterio de modelado

La base esta organizada para la operacion interna de La Vitamina. La columna `organization_id` sigue siendo el eje de aislamiento, pero funcionalmente el sistema representa la gestion de una sola empresa de marketing que administra sus propias cuentas cliente.

## Nucleo relacional vigente

```text
organizations (1) -> (N) users
organizations (1) -> (N) leads
organizations (1) -> (N) clients
organizations (1) -> (N) crm_contacts
organizations (1) -> (N) crm_opportunities
organizations (1) -> (N) crm_interactions
organizations (1) -> (N) integration_accounts

leads (1) -> (0..1) clients
leads (1) -> (N) crm_contacts
leads (1) -> (N) crm_opportunities
leads (1) -> (N) crm_interactions
integration_accounts (1) -> (N) meta_lead_webhook_events
```

## Entidades criticas

### `users`

Campos funcionales relevantes:

- `organization_id`
- `name`
- `email`
- `password`
- `role`
- `client_id`
- `is_active`

Reglas:

- email normalizado en minuscula
- telefono sanitizado
- usuarios cliente pueden asociarse a una empresa concreta via `client_id`

### `clients`

Representa las empresas/cuentas gestionadas por La Vitamina.

Campos relevantes:

- `organization_id`
- `lead_id`
- `community_manager_id`
- `name`
- `legal_name`
- `industry`
- `status`
- `retainer_amount`
- `currency`
- `default_ud_budget`

### `leads`

Campos comerciales y de cumplimiento ya presentes:

- `organization_id`
- `name`
- `email`
- `phone`
- `company`
- `source`
- `source_detail`
- `external_lead_id`
- `external_form_id`
- `external_campaign_id`
- `campaign_name`
- `page_id`
- `status`
- `fit_status`
- `quality_score`
- `discard_reason`
- `assigned_to`
- `consent_captured_at`
- `retention_review_at`
- `metadata`
- `converted_at`
- `converted_to_client_id`

Reglas:

- dedupe por `external_lead_id`, email o telefono
- normalizacion por hooks y por servicio de intake
- descarte explicito con motivo

### `crm_contacts`

Contacto comercial derivado del lead util.

### `crm_opportunities`

Oportunidad comercial creada automaticamente cuando el lead supera el umbral operativo definido.

### `crm_interactions`

Bitacora comercial. Ya se usan al menos estos tipos:

- `lead_ingested`
- `lead_qualified`
- `lead_discarded`

### `meta_lead_webhook_events`

Trazabilidad tecnica de eventos `leadgen` recibidos desde Meta.

## Consistencia y ACID

La ingesta comercial actual no es solo un insert aislado:

1. se recibe el payload
2. se descarga el detalle real desde Meta
3. se normaliza
4. se deduplica
5. se guarda el lead
6. se generan automatizaciones minimas CRM

Ese flujo corre ahora dentro de transaccion TypeORM para evitar estados parciales entre lead, contacto, oportunidad e interacciones.

## Seguridad de datos

- contraseñas hasheadas con `bcrypt`
- anonimización disponible para leads
- exportacion de lead para derechos del titular
- job para anonimizar leads descartados vencidos

Pendiente de evolucion posterior:

- cifrado selectivo de PII sensible en reposo
- politicas mas finas de masking en listados y auditoria

## Indices recomendados a mantener

- `users(email)`
- `users(organization_id, role, is_active)`
- `users(client_id)`
- `leads(organization_id, status)`
- `leads(organization_id, fit_status)`
- `leads(organization_id, external_lead_id)`
- `leads(organization_id, email)`
- `leads(organization_id, phone)`
- `clients(organization_id, status)`
- `crm_opportunities(organization_id, lead_id)`
- `crm_interactions(organization_id, lead_id, type)`
- `meta_lead_webhook_events(account_id, leadgen_id)` si la migracion fisica aun no lo contempla

## Migraciones y synchronize

Regla esperada:

- `synchronize` solo en desarrollo controlado
- produccion y staging deben moverse por migraciones versionadas

Si el schema vuelve a desalinearse, la fuente de verdad debe ser:

1. entidades TypeORM
2. migraciones
3. documentacion tecnica actualizada

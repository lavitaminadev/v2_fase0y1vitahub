# Arquitectura de VITAHUB

## Proposito real

VITAHUB no se esta modelando como un SaaS abierto para multiples agencias. En el estado actual del proyecto esta orientado a **La Vitamina** como sistema operativo interno para gestionar:

- cuentas y empresas cliente
- captacion comercial y CRM
- produccion y aprobaciones
- operaciones, reuniones, onboarding y facturacion

La separacion por `organization_id` sigue existiendo a nivel tecnico para mantener aislamiento de datos y orden operacional, pero el diseño funcional debe responder al flujo interno de La Vitamina.

## Estructura

```text
apps/
  api/   NestJS + TypeORM + MySQL
  web/   React + React Query + rutas protegidas por sesion y rol
packages/
  shared/ tipos compartidos entre API y frontend
docs/
  arquitectura, base de datos, roadmap CRM/Meta
```

## Capas principales

### API

- `core/`
  - auth JWT
  - autorizacion por roles
  - proteccion de datos
  - jobs programados
  - observabilidad y errores
- `modules/`
  - `users`, `clients`, `crm`, `integrations`, `production`, `billing`, `meetings`, `onboarding`, `documents`, etc.

### Web

- `core/`
  - auth store
  - router
  - `ProtectedRoute`
  - registro de navegacion por feature manifest
- `features/`
  - pantallas operativas y comerciales
- `shared/`
  - tabla, modal, badges, loading, empty states

## Reglas operativas vigentes

### Autorizacion

- Toda ruta interna requiere sesion.
- Las vistas sensibles se bloquean por rol usando los mismos manifests que definen navegacion.
- `users`, `crm/leads`, `integrations`, `billing`, `operations`, `direction` y `settings` respetan rol explicito.

### Gestion de usuarios

- El admin u operaciones crea cuentas dentro de su propia organizacion.
- Ya no se permite inyectar libremente `organizationId` desde la pantalla de usuarios.
- Las cuentas portal cliente pueden vincularse a una empresa especifica mediante `clientId`.
- La modificacion de rol, activacion y asignacion de empresa queda centralizada en gestion de usuarios.

### CRM comercial

Flujo vigente:

1. Meta genera `leadgen`.
2. Webhook entra a API.
3. Se guarda evento tecnico RAW.
4. Se descarga el detalle real con `leadgen_id`.
5. El lead se normaliza y deduplica.
6. Se calcula score y `fitStatus`.
7. Si califica:
   - se registra interaccion de ingreso
   - se asigna responsable comercial si existe
   - se crea contacto CRM
   - se crea oportunidad CRM
8. Si no califica:
   - se descarta con motivo
   - se registra interaccion de descarte

### ACID y consistencia

- La captura de leads corre dentro de una transaccion TypeORM.
- La persistencia del lead y la automatizacion comercial minima se ejecutan en el mismo ciclo transaccional.
- La normalizacion de `User` y `Lead` se refuerza con hooks de entidad (`BeforeInsert` y `BeforeUpdate`).

## Seguridad y cumplimiento

- Passwords con `bcrypt`.
- Scope por organizacion en usuarios, clientes y CRM.
- Exportacion y anonimización de leads desde `data-protection`.
- Job de retencion para anonimizar leads descartados vencidos.
- No se deben exponer vistas no autorizadas ni permitir cambio de organizacion desde cliente web.

## Integracion Meta

Estado implementado:

- OAuth Meta
- seleccion de activos
- health de conexion
- webhook `leadgen`
- sync manual real por `pageId` + `leadgenId`
- base para revision de Meta App Review

Documento complementario: `docs/crm-meta-roadmap.md`.

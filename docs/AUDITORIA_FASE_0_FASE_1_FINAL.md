# Auditoria final Fase 0 y Fase 1 - VitaHub

Fecha: 2026-07-29

## Resultado ejecutivo

Estado recomendado: APROBADO PARA DEMO LOCAL / STAGING CONTROLADO.

No se recomienda aprobar produccion real todavia porque las variables reales de Meta no estan configuradas en el entorno auditado (`META_APP_ID`, `META_APP_SECRET`, `META_CONVERSIONS_ACCESS_TOKEN`, `META_TEST_EVENT_CODE`, `APP_PUBLIC_URL`). La aplicacion si queda alineada para presentar Fase 0 y Fase 1 en local: reservas, clientes, contactos/comensales, CRM comercial separado y Eventos CAPI.

## Correcciones aplicadas

- Se limpio el portal cliente para Fase 1: solo muestra Inicio y Reservas. Grilla, aprobaciones, reuniones e informes quedan ocultos y redirigen a Reservas salvo que se active `VITE_ENABLE_FUTURE_MODULES=true`.
- Se limpio el dashboard admin para Fase 1: se ocultaron produccion, piezas, UD, ciclo maestro y Pulso Vitamina porque mezclaban fases futuras con reservas/CRM/Meta.
- Se separo CRM operativo y comercial en navegacion: `Comensales y contactos` para Restaurante -> comensal; `Prospectos`, `Pipeline comercial` y `Actividad comercial` para La Vitamina -> restaurante.
- Se agrego vista admin `Eventos CAPI` con metricas, filtros, listado, detalle seguro y reintento.
- Se agregaron endpoints seguros:
  - `GET /integrations/meta/events/stats`
  - `GET /integrations/meta/events`
  - `GET /integrations/meta/events/:eventId`
  - `POST /integrations/meta/events/:eventId/retry`
- La vista CAPI no expone datos personales crudos: muestra claves de matching presentes, no email, telefono, IP ni user agent.
- Se reforzo la reserva publica contra sobrecupo de ultimo cupo con test de bloqueo pesimista.
- Se agrego metadata no sensible al evento CAPI: cliente, formulario, reserva y codigo de referencia.

## Validaciones ejecutadas

- `npm.cmd run build:api`: OK.
- `npm.cmd run build:web`: OK.
- `npm.cmd run test:api -- reservations.service.spec.ts meta-conversion-outbox.service.spec.ts permission-resolver.service.spec.ts reservations.controller.spec.ts lead.controller.spec.ts`: 50 tests OK.
- `npm.cmd run test:web`: 16 tests OK.
- `npm.cmd run local:status`: MariaDB 3307, API 3000 y Web 5173 activos.
- Smoke API:
  - Admin reservas/forms: 200.
  - Admin reservas/lista: 200.
  - Admin CRM contactos/leads/oportunidades: 200.
  - Admin Eventos CAPI stats/lista: 200.
  - Cliente reservas/forms y reservas/lista: 200.
  - Cliente CRM comercial: 403.
  - Cliente Eventos CAPI: 403.
- Smoke visual con Chrome:
  - Admin dashboard Fase 1 sin modulos futuros.
  - Admin Eventos CAPI visible y sin errores 500.
  - Portal cliente sin CRM comercial ni modulos futuros.

## Evidencias

Carpeta: `docs/evidence/fase-1-production/`

Archivos principales:
- `audit-admin-dashboard-clean.png`
- `audit-admin-capi-clean.png`
- `audit-client-home-clean.png`
- `role-visual-audit-clean.json`

## Pendientes antes de produccion real

- Configurar y validar credenciales reales de Meta/Conversions API sin imprimir secretos.
- Definir `APP_PUBLIC_URL` real HTTPS para eventos web.
- Corregir warning de Vite: `NODE_ENV=production is not supported in the .env file`.
- Mejorar scripts locales: `local:start` no reinicia procesos viejos y puede parecer pegado si el puerto ya esta ocupado o si tarda el health check.
- Hacer prueba end-to-end real: formulario publico -> reserva -> contacto/comensal -> evento CAPI encolado -> cron CAPI -> Meta Test Events.

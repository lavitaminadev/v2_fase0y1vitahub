# Changelog Estabilizacion

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-16`
FUENTE: fase de estabilizacion sobre repo local

## Formato

- ID
- Problema
- Causa raiz
- Solucion
- Archivos
- Prueba realizada
- Resultado
- Riesgo

## Entradas

- ID: EST-001
  Problema: `build:api` fallaba por imports relativos rotos en el job de recuperacion de leads Meta.
  Causa raiz: refactor previo dejo rutas `../../../../` apuntando fuera del modulo correcto.
  Solucion: ajuste de imports al nivel real del arbol.
  Archivos: `apps/api/src/core/jobs/cron/meta-lead-recovery.job.ts`
  Prueba realizada: `npm run build:api`, `npm run lint:api`
  Resultado: PASS
  Riesgo: bajo; cambio acotado a resolucion de modulos.

- ID: EST-002
  Problema: `build:api` fallaba porque el handler de conversion usaba `IntegrationAccountType.PIXEL`, valor inexistente.
  Causa raiz: el flujo CAPI asumía una entidad/tipo de cuenta Meta que no existe en el modelo actual.
  Solucion: resolver `pageId` desde el lead, buscar cuenta `PAGE`, leer `pixelId` desde `integration.config` y usar token dedicado o token seguro de la pagina/integracion.
  Archivos: `apps/api/src/modules/integrations/meta/handlers/lead-converted.handler.ts`
  Prueba realizada: `npm run build:api`, `npm run test:api`
  Resultado: PASS
  Riesgo: medio; el envio real a Meta sigue dependiendo de credenciales y pixel validos.

- ID: EST-003
  Problema: `build:web` fallaba por imports rotos y tipos incompletos en el drawer de detalle de lead.
  Causa raiz: la UI CRM quedo movida de carpeta y el componente seguia importando con rutas legacy; ademas el `useQuery` no estaba tipado.
  Solucion: corregir imports, declarar interfaz `LeadDetail` y tipar la consulta.
  Archivos: `apps/web/src/features/crm/components/LeadDetailDrawer.tsx`
  Prueba realizada: `npm run build:web`
  Resultado: PASS
  Riesgo: bajo.

- ID: EST-004
  Problema: `build:web` fallaba por variables sin uso en `LeadsPage.tsx`.
  Causa raiz: quedaron restos de integraciones de oportunidades/interacciones/export/anonymize no usados por la pantalla actual.
  Solucion: eliminar tipos, consultas y mutaciones no utilizadas.
  Archivos: `apps/web/src/features/crm/LeadsPage.tsx`
  Prueba realizada: `npm run build:web`, `npm run lint:web`
  Resultado: PASS
  Riesgo: bajo; no cambia comportamiento visible.

- ID: EST-005
  Problema: la UI CRM llamaba `GET /crm/leads/:id`, pero el backend no exponia ese endpoint.
  Causa raiz: el flujo de detalle de lead estaba implementado solo en frontend.
  Solucion: crear `GetLeadUseCase`, registrarlo en `CrmModule` y agregar `@Get(':id')` en `LeadController`.
  Archivos: `apps/api/src/modules/crm/leads/use-cases/get-lead.use-case.ts`, `apps/api/src/modules/crm/leads/lead.controller.ts`, `apps/api/src/modules/crm/crm.module.ts`
  Prueba realizada: `npm run build:api`, `npm run build:web`, `npm run test:api`
  Resultado: PASS
  Riesgo: medio-bajo; mejora contrato real frontend-backend.

- ID: EST-006
  Problema: la sincronizacion manual de leads Meta podia intentar operar sobre paginas de otra organizacion.
  Causa raiz: `POST /integrations/meta/leads/sync` validaba autenticacion y rol, pero no propagaba `organizationId` al servicio.
  Solucion: pasar `req.organizationId` a `syncSingleLead()` y verificar pertenencia de la pagina antes de recuperar el lead.
  Archivos: `apps/api/src/modules/integrations/meta/meta-pixel.controller.ts`, `apps/api/src/modules/integrations/meta/meta-lead-ads.service.ts`
  Prueba realizada: `npm run build:api`, `npm run test:api -- meta-lead-ads.service.spec.ts oauth-state.spec.ts`, `npm run test:api`
  Resultado: PASS
  Riesgo: bajo; endurece autorizacion.

- ID: EST-007
  Problema: el webhook y la sincronizacion podian procesar paginas Meta descubiertas pero no seleccionadas operativamente.
  Causa raiz: el servicio resolvia pagina por `externalId` sin exigir `metadata.selected`.
  Solucion: ignorar eventos de paginas no seleccionadas y registrar el motivo en `meta_lead_webhook_events`.
  Archivos: `apps/api/src/modules/integrations/meta/meta-lead-ads.service.ts`
  Prueba realizada: `npm run test:api`
  Resultado: PASS
  Riesgo: medio-bajo; puede dejar de aceptar eventos de configuraciones incompletas, que era el comportamiento deseado.

- ID: EST-008
  Problema: faltaba prueba automatizada para aislamiento de organizacion y seleccion de pagina en Meta Lead Ads.
  Causa raiz: la suite original cubria descarga/normalizacion, pero no boundary checks.
  Solucion: agregar 2 pruebas nuevas.
  Archivos: `apps/api/test/unit/integrations/meta-lead-ads.service.spec.ts`
  Prueba realizada: `npm run test:api`
  Resultado: PASS, suite sube de 97 a 99 tests
  Riesgo: nulo.

- ID: EST-009
  Problema: el modulo de reportes consultaba la tabla `billing_invoices`, pero la entidad real usa `invoices`.
  Causa raiz: desalineacion entre SQL manual del controlador y el modelo real de persistencia.
  Solucion: corregir queries para usar `invoices.total` y no `billing_invoices.amount`.
  Archivos: `apps/api/src/modules/reports/reports.controller.ts`
  Prueba realizada: `npm run build:api`, `npm run test:api -- reporting.controller.spec.ts`, `npm run test:api`
  Resultado: PASS
  Riesgo: medio-bajo; mejora exactitud y evita fallos reales contra base de datos.

- ID: EST-010
  Problema: el portal cliente consumia `GET /reporting/reports` como si devolviera una lista de reportes, pero el backend devuelve un resumen agregado.
  Causa raiz: contrato frontend-backend no alineado.
  Solucion: adaptar `ClientReports` para representar el resumen real disponible y dejar de mostrar vacio falso.
  Archivos: `apps/web/src/features/client-portal/ClientReports.tsx`
  Prueba realizada: `npm run build:web`
  Resultado: PASS
  Riesgo: bajo.

- ID: EST-011
  Problema: los KPIs estrategicos mostraban metas y metricas inventadas como si fueran reales.
  Causa raiz: valores hardcodeados (`500000`, `20`, `500`, `80`, `NPS 8`, `growth 15`) incrustados en backend.
  Solucion: devolver `null` para metas/fuentes no verificables y adaptar la UI para mostrar "no configurada" o "no disponible".
  Archivos: `apps/api/src/modules/reports/reports.controller.ts`, `apps/web/src/features/direction/DirectionPage.tsx`
  Prueba realizada: `npm run build:api`, `npm run build:web`, `npm run test:api`
  Resultado: PASS
  Riesgo: bajo; reduce informacion engañosa.

- ID: EST-012
  Problema: faltaba cubrir con tests la tabla real de facturacion, el scoping client portal y la eliminacion de metas inventadas.
  Causa raiz: no existian pruebas del controlador de reportes.
  Solucion: agregar suite unitaria nueva para `ReportingController`.
  Archivos: `apps/api/test/unit/reports/reporting.controller.spec.ts`
  Prueba realizada: `npm run test:api`
  Resultado: PASS, suite sube de 99 a 102 tests
  Riesgo: nulo.

- ID: EST-013
  Problema: un usuario `client` podia consultar endpoints internos sensibles (`/dashboard/*`, `/operations/overview`, `reporting/dashboard`, `reporting/kpi`) si llamaba la API directamente.
  Causa raiz: varios controladores exigian JWT, pero no restringian rol.
  Solucion: agregar `@Roles(...)` solo para roles internos en dashboards, operations y reporting sensible.
  Archivos: `apps/api/src/modules/dashboards/dashboards.controller.ts`, `apps/api/src/modules/operations/operations.controller.ts`, `apps/api/src/modules/reports/reports.controller.ts`
  Prueba realizada: `npm run build:api`, `npm run test:api`, `npm run lint:api`
  Resultado: PASS
  Riesgo: bajo; endurece autorizacion sin cambiar contratos internos visibles.

- ID: EST-014
  Problema: `GET /organizations` devolvia todas las organizaciones a cualquier usuario autenticado.
  Causa raiz: el caso de uso listaba toda la tabla y el controlador no aplicaba scoping por actor.
  Solucion: para no-admin devolver solo la organizacion actual; admin mantiene visibilidad global.
  Archivos: `apps/api/src/modules/organizations/list-organizations.use-case.ts`, `apps/api/src/modules/organizations/organizations.controller.ts`
  Prueba realizada: `npm run build:api`, `npm run test:api`
  Resultado: PASS
  Riesgo: bajo.

- ID: EST-015
  Problema: un usuario `client` podia listar o pedir detalles de otros clientes de su misma organizacion.
  Causa raiz: `clients.controller.ts` no aplicaba scoping por `clientId` del actor portal.
  Solucion: si el actor es `client`, `GET /clients` devuelve solo su ficha y `GET /clients/:id` rechaza cualquier otro id.
  Archivos: `apps/api/src/modules/clients/clients.controller.ts`
  Prueba realizada: `npm run build:api`, `npm run test:api`
  Resultado: PASS
  Riesgo: bajo.

- ID: EST-016
  Problema: `PUT/DELETE /content/items/:id` actualizaban por id sin comprobar pertenencia a la organizacion actual.
  Causa raiz: uso directo de `update/delete` por id sin validar `contentGrid.organizationId`.
  Solucion: cargar item con su `contentGrid`, verificar tenant y solo entonces guardar o eliminar.
  Archivos: `apps/api/src/modules/content/content.controller.ts`
  Prueba realizada: `npm run build:api`, `npm run test:api`
  Resultado: PASS
  Riesgo: medio-bajo; corrige boundary multiempresa.

- ID: EST-017
  Problema: el flujo oficial de despliegue en iHosting/cPanel no estaba implementado en el repo.
  Causa raiz: faltaba `.cpanel.yml` y la estrategia de Passenger + frontend estatico solo estaba parcialmente documentada.
  Solucion: crear `.cpanel.yml`, agregar `build:cpanel`, corregir `start:prod` en API y alinear documentacion operativa minima a cPanel/Passenger.
  Archivos: `.cpanel.yml`, `package.json`, `apps/api/package.json`, `docs/deployment/ihosting.md`, `docs/architecture/current.md`
  Prueba realizada: `npm run build:cpanel`, `npm run build:api`, `npm run build:web`, `npm run lint:api`, `npm run lint:web`
  Resultado: PASS
  Riesgo: medio-bajo; deja listo el camino tecnico, pero cPanel seguira exigiendo working tree limpio antes de usar Git deployment.

- ID: EST-018
  Problema: los scripts `infrastructure/deploy.sh` e `infrastructure/ihosting/deploy.ps1` seguian sugiriendo Docker como ruta principal de deploy.
  Causa raiz: herencia de una estrategia vieja no alineada con iHosting/cPanel.
  Solucion: marcarlos explicitamente como `legacy Docker deploy script` para evitar confusion operacional.
  Archivos: `infrastructure/deploy.sh`, `infrastructure/ihosting/deploy.ps1`
  Prueba realizada: revision manual de consistencia con la estrategia oficial
  Resultado: actualizado
  Riesgo: bajo.

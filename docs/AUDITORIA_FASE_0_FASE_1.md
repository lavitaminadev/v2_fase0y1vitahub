# Auditoria Fase 0 y Fase 1

Fecha de auditoria: `2026-07-29`

Fuente de verdad usada:

- codigo real en `apps/api`, `apps/web`, `database`, `docs`
- entorno local activo con `MariaDB 3307`, `API 3000`, `Web 5173`
- builds y pruebas ejecutadas hoy
- documentos vigentes:
  - `docs/current/01-ESTADO-ACTUAL.md`
  - `docs/current/03-CRM.md`
  - `docs/current/06-RESERVATIONS.md`
  - `docs/current/04-META-INTEGRATION.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DATABASE.md`

Limitaciones honestas de esta pasada:

- no se realizo envio real a Meta ni OAuth real con credenciales productivas;
- no se conto con render de evidencia visual automatica del navegador en esta pasada;
- la verificacion visual se apoya en evidencia previa documentada y en el estado compilado actual;
- la recomendacion final no declara produccion lista mientras esos bloqueos externos sigan pendientes.

## A. Resumen Ejecutivo

- Estado general: base funcional real, con Fase 0 avanzada y Fase 1 operativa pero aun con cierres parciales.
- Porcentaje estimado completado:
  - Fase 0: `85%`
  - Fase 1: `72%`
- Riesgos criticos:
  - Meta CAPI y Pixel no estan revalidados hoy con credenciales reales.
  - El menu y la experiencia aun muestran modulos fuera de alcance para Fase 1.
  - La separacion entre CRM comercial de La Vitamina y CRM operativo de comensales existe, pero sigue parcial en modelo y narrativa.
  - No existe evidencia ejecutada hoy de un recorrido visual completo ruta por ruta en admin, cliente y comensal.
- Bloqueos:
  - credenciales reales de Meta y Google;
  - validacion visual interactiva completa en navegador;
  - falta de limpieza de alcance para ocultar modulos no Fase 1.
- Recomendacion:
  - `APROBADO CON OBSERVACIONES` para seguir consolidando Fase 0 y Fase 1 en staging.
  - `NO APROBADO` para produccion final mientras no se valide Meta real, aislamiento visual completo y depuracion de modulos fuera de alcance.

## B. Matriz De Requisitos

| ID | Modulo | Requisito | Frontend | Backend | BD | Seguridad | Pruebas | Estado |
| -- | ------ | --------- | -------- | ------- | -- | --------- | ------- | ------ |
| R01 | Arquitectura | Separacion frontend, backend y persistencia | `apps/web` | `apps/api` | `database` | Aplicada | Builds PASS | ✅ |
| R02 | Multi-tenant | Aislamiento por organizacion y cliente | Filtros y portal cliente | `AccountAccessService`, scopes | `organization_id`, `client_id` | Endurecido | tests API PASS | 🟡 |
| R03 | Auth | Login y sesion | `/login`, guards | `/auth/*` | users, refresh tokens | JWT y roles | PASS | ✅ |
| R04 | Roles | Admin ve todo, cliente solo su cuenta | Parcialmente visible | Restricciones reales en API | clients/users | Reglas activas | PASS | 🟡 |
| R05 | Reservas publicas | Flujo publico de reserva | `PublicReservationPage` | `/public/reservations/*` | reservations, forms, events | Validacion backend | tests PASS | ✅ |
| R06 | Disponibilidad | Horarios, bloqueos, tope diario | `ReservationBuilderPage`, cliente | reservations service | forms, availability blocks | Validacion backend | pruebas unitarias/integracion | ✅ |
| R07 | Concurrencia | Evitar sobreventa del ultimo cupo | Sin evidencia visual hoy | validacion final backend | reservations/forms | Parcial | pruebas indirectas | 🧪 |
| R08 | CRM comensales | Contacto de reservas por cliente | `/crm/contacts` | `LeadIntakeService`, leads list | `leads` | Scoping por cliente | PASS | ✅ |
| R09 | CRM comercial agencia | Prospectos y pipeline independiente | `/crm/leads`, `/crm/opportunities`, `/crm/interactions` | modulos CRM | `leads`, `crm_*`, `clients` | Roles internos | PASS | 🟡 |
| R10 | Separacion de CRMs | No mezclar agencia y comensales | naming y contexto mejorados | scoping parcial | modelo aun reutiliza `leads` | Parcial | parcial | 🟡 |
| R11 | Dashboard admin | KPIs reales de reservas/clientes | existe | endpoints reales | varias tablas | restringido | parcial | 🟡 |
| R12 | Dashboard cliente | Solo datos propios | existe | `/reporting/reports`, `/clients` scoped | varias tablas | protegido | PASS parcial | 🟡 |
| R13 | Asistencia | Marcar asistio/no asistio | UI y reservas | reservations update | reservations/events | audit trail parcial | PASS | ✅ |
| R14 | Meta reserva | Evento por reserva via CAPI | integrado en flujo | outbox/handlers | eventos/integrations | tokens backend | sin credencial real hoy | 🔒 |
| R15 | Meta asistencia | Evento por asistencia | integrado | outbox/handlers | eventos/integrations | tokens backend | sin credencial real hoy | 🔒 |
| R16 | Deduplicacion Meta | evitar duplicados/idempotencia | no visible | outbox + idempotencia parcial | eventos y leads | parcial | tests servicio | 🟡 |
| R17 | Menu admin Fase 1 | menu alineado a alcance real | aun expone extras | n/a | n/a | n/a | no | 🟡 |
| R18 | Menu cliente Fase 1 | solo modulos propios | portal cliente acotado | scoping real | n/a | protegido | parcial | 🟡 |
| R19 | Eventos CAPI | monitoreo visible | no modulo dedicado limpio | existe backend | integraciones | restringido | parcial | 🟡 |
| R20 | Auditoria y trazabilidad | registro de acciones criticas | notificaciones/feedback parcial | audit interceptor/logs | audit_logs | activo | parcial | 🟡 |
| R21 | Seguridad | secretos fuera del frontend | si | variables server-side | n/a | correcto | validacion parcial | ✅ |
| R22 | Seguridad | no exponer tokens Meta | no visibles | tokens cifrados backend | integrations | correcto | PASS parcial | ✅ |
| R23 | Testing | pruebas unitarias/integracion | web 16 tests | api 293 tests | cubre flujos clave | n/a | ejecutadas hoy | ✅ |
| R24 | Fuera de alcance | no presentar billing/xp/produccion como Fase 1 | aun visibles | existen | existen | n/a | no | 🟡 |

## C. Hallazgos

### H01

- Severidad: Alta
- Descripcion: no existe evidencia ejecutada hoy de Meta Pixel/CAPI real con credenciales aprobadas.
- Evidencia:
  - `npm run local:status` PASS
  - `npm run test:api` PASS
  - no se ejecuto OAuth ni evento real contra Meta hoy
- Archivos:
  - `apps/api/src/modules/integrations/meta/*`
  - `docs/current/04-META-INTEGRATION.md`
- Impacto: no se puede declarar produccion lista ni conversion real comprobada.
- Correccion: no aplicada en esta pasada; requiere credenciales reales y prueba controlada.

### H02

- Severidad: Alta
- Descripcion: la separacion entre CRM comercial de La Vitamina y CRM operativo de comensales sigue parcial a nivel de modelo de datos.
- Evidencia:
  - `docs/current/03-CRM.md` reencuadra Fase 1 como contactos operacionales
  - `leads` sigue siendo base reutilizada para ambos relatos
- Archivos:
  - `apps/api/src/modules/crm/leads/*`
  - `docs/current/03-CRM.md`
  - `docs/DATABASE.md`
- Impacto: puede generar confusion funcional, filtros incorrectos y narrativa ambigua.
- Correccion:
  - se reforzo navegacion y contexto visible en frontend;
  - se agrego scoping por cliente a oportunidades/interacciones.

### H03

- Severidad: Media
- Descripcion: el menu sigue mostrando modulos fuera de alcance de Fase 1 como produccion, billing, gamification y otros.
- Evidencia:
  - `apps/web/src/shared/Layout.tsx`
  - `apps/web/src/core/navigation.registry.ts`
- Impacto: en presentacion Fase 1 puede dar la sensacion de producto mezclado o promesa sobredimensionada.
- Correccion:
  - se reorganizaron grupos `Operacion clientes` y `Comercial La Vitamina`;
  - pendiente ocultar completamente modulos no Fase 1 si la presentacion lo requiere.

### H04

- Severidad: Media
- Descripcion: no existe un modulo administrativo claramente nombrado como `Eventos CAPI` para monitoreo operativo.
- Evidencia:
  - el requerimiento lo pide;
  - hoy hay integracion y outbox, pero no una vista dedicada limpia de eventos.
- Archivos:
  - `apps/api/src/modules/integrations/meta/*`
  - `apps/web/src/features/integrations/*`
- Impacto: dificulta demostrar trazabilidad visual completa al admin.
- Correccion: no aplicada en esta pasada.

### H05

- Severidad: Media
- Descripcion: la experiencia admin/cliente ya respeta mejor el contexto por cliente, pero aun no hay una vista 1 totalmente depurada del alcance.
- Evidencia:
  - cambios recientes en `CrmScopeBanner`, `CrmNav`, `Layout`, `LeadsPage`, `CrmRecordsPage`
- Archivos:
  - `apps/web/src/features/crm/*`
  - `apps/web/src/shared/Layout.tsx`
- Impacto: mejora la lectura, pero aun queda trabajo de limpieza de menu y orden visual.
- Correccion: aplicada parcialmente hoy.

### H06

- Severidad: Media
- Descripcion: la auditoria visual completa de escritorio/tablet/movil hoy no fue rehecha ruta por ruta.
- Evidencia:
  - hay builds en verde;
  - existe evidencia previa documentada, pero no nueva sesion visual completa hoy.
- Impacto: pueden persistir problemas menores de UX no capturados en esta pasada.
- Correccion: pendiente validacion interactiva final.

### H07

- Severidad: Baja
- Descripcion: el entorno y las pruebas siguen mostrando modulos e integraciones adicionales como Google Ads outbox y billing, fuera del centro de Fase 1.
- Evidencia:
  - warnings de `GoogleConversionOutboxService` durante pruebas
  - modulos presentes en menu/codigo
- Impacto: ruido funcional y tecnico.
- Correccion: no aplicada en esta pasada.

## D. Flujos Verificados

### Onboarding

- Parcialmente verificado por estructura de clientes, formularios, integraciones y docs.
- No hubo recorrido visual completo hoy de alta de cliente paso a paso.
- Estado: `🟡 Implementado parcialmente`

### Reserva

- Verificado por:
  - `npm run local:status`
  - suite `test:api` PASS
  - `docs/current/01-ESTADO-ACTUAL.md`
- Incluye pagina publica, persistencia, contacto derivado y actualizacion de paneles.
- Estado: `✅ Implementado y funcionando`

### Disponibilidad

- Verificado por modulo de reservas, builder, bloqueos y tope diario.
- Existe validacion backend y pruebas.
- Estado: `✅ Implementado y funcionando`

### Asistencia

- Existe cambio de estado, actualizacion de contacto y gancho de conversion.
- El envio real a Meta por asistencia no se comprobo hoy con credenciales reales.
- Estado: `🟡 Implementado parcialmente`

### Contactos

- Contactos de reservas operativos en `/crm/contacts`.
- Filtros por cliente y estado reales.
- Estado: `✅ Implementado y funcionando`

### Meta CAPI

- Flujo tecnico implementado.
- Token y cifrado backend presentes.
- Falta evidencia real de extremo a extremo hoy.
- Estado: `🔒 Bloqueado por credenciales o servicio externo`

### Roles

- Backend con roles y scopes reales.
- Cliente no deberia ver CRM comercial interno.
- Se reforzaron boundaries previos y hoy se agrego scoping comercial por cliente.
- Estado: `🟡 Implementado parcialmente`

### Multi-tenant

- `organization_id` y `client_id` presentes y usados.
- Mejorado scope en `leads`, `opportunities`, `interactions`, portal cliente y reservas.
- Modelo aun reutiliza `leads` para dominios distintos.
- Estado: `🟡 Implementado parcialmente`

## E. Cambios Realizados

### En esta pasada de auditoria

| Archivo | Cambio | Motivo | Resultado |
| ------- | ------ | ------ | --------- |
| `apps/api/src/modules/crm/opportunities/dto/list-opportunities.dto.ts` | se agrego `clientId` | filtrar pipeline por cliente | PASS |
| `apps/api/src/modules/crm/opportunities/use-cases/list-opportunities.use-case.ts` | soporte de scope por cliente | evitar mezcla en comercial | PASS |
| `apps/api/src/modules/crm/opportunities/opportunities.controller.ts` | scoping por `AccountAccessService` | respetar visibilidad por cuenta | PASS |
| `apps/api/src/modules/crm/interactions/dto/list-interactions.dto.ts` | se agrego `clientId` | filtrar actividad por cliente | PASS |
| `apps/api/src/modules/crm/interactions/interactions.service.ts` | join a leads/contactos para scope cliente | no mezclar interacciones | PASS |
| `apps/api/src/modules/crm/interactions/interactions.controller.ts` | scoping por cuenta | seguridad y coherencia | PASS |
| `apps/web/src/features/crm/CrmScopeBanner.tsx` | nuevo banner de contexto | distinguir CRM agencia vs operacion cliente | PASS |
| `apps/web/src/features/crm/CrmNav.tsx` | renombrado y separacion de secciones | claridad funcional | PASS |
| `apps/web/src/features/crm/feature.manifest.ts` | etiquetas CRM actualizadas | evitar mezcla conceptual | PASS |
| `apps/web/src/core/navigation.registry.ts` | orden de navegacion ajustado | priorizar operacion y contexto | PASS |
| `apps/web/src/shared/Layout.tsx` | grupos `Operacion clientes` y `Comercial La Vitamina` | lectura mas clara del menu | PASS |
| `apps/web/src/features/crm/LeadsPage.tsx` | banner, filtro y query por cliente | separar prospectos de agencia | PASS |
| `apps/web/src/features/crm/CrmRecordsPage.tsx` | banner, filtros y queries por cliente | separar contactos, oportunidades e interacciones | PASS |
| `apps/web/src/styles/crm.css` | estilos del contexto CRM | soporte visual del nuevo orden | PASS |

## F. Pruebas Ejecutadas

| Comando | Resultado | Cantidad de pruebas | Errores |
| ------- | --------- | ------------------- | ------- |
| `npm.cmd run local:status` | PASS | n/a | ninguno |
| `npm.cmd run build:api` | PASS | n/a | ninguno |
| `npm.cmd run build:web` | PASS | n/a | warning de `NODE_ENV=production` en Vite, no bloqueante |
| `npm.cmd run test:api` | PASS | `60` archivos, `293` tests | warnings esperados de integraciones simuladas y logs de prueba |
| `npm.cmd run test:web` | PASS | `3` archivos, `16` tests | ninguno |

Cobertura:

- no se genero reporte de coverage hoy;
- existe buena cobertura funcional backend sobre reservas, CRM, autorizacion e integraciones.

## G. Pendientes

| Pendiente | Prioridad | Dependencia | Riesgo | Recomendacion |
| --------- | --------- | ----------- | ------ | ------------- |
| Validar Meta CAPI real con Pixel y token reales | Alta | credenciales Meta | Alto | ejecutar prueba controlada en staging |
| Limpiar menu de modulos fuera de Fase 1 | Alta | decision funcional | Medio | ocultar billing/xp/produccion si hoy no se presentan |
| Separar mas claramente CRM comercial y CRM comensales a nivel documental/modelo | Alta | decision de arquitectura | Medio | mantener reuse tecnico, pero aislar narrativa y filtros |
| Rehacer recorrido visual completo admin/cliente/comensal | Media | tiempo de QA manual | Medio | sesion final con navegador y capturas |
| Crear vista dedicada de eventos CAPI | Media | frontend + backend | Medio | ayuda mucho para demo y soporte |
| Confirmar concurrencia del ultimo cupo con prueba explicita | Media | prueba adicional | Medio | agregar test de carrera o test de servicio dedicado |
| Revisar rutas y nombres equivalentes vs lista ideal del brief | Media | limpieza funcional | Bajo | documentar equivalencias si no cambian endpoints |

## H. Evidencia Visual

Evidencia disponible y referenciada:

- `docs/current/01-ESTADO-ACTUAL.md`
  - dashboard admin y cliente verificados previamente
  - login escritorio/movil verificado previamente
  - flujo de reserva publica verificado previamente
- estado compilado actual:
  - `build:web` PASS luego de los cambios de separacion CRM

Referencias de vistas afectadas en esta pasada:

- Dashboard admin y menu:
  - `apps/web/src/shared/Layout.tsx`
- CRM comensales:
  - `apps/web/src/features/crm/CrmRecordsPage.tsx`
- CRM comercial:
  - `apps/web/src/features/crm/LeadsPage.tsx`
  - `apps/web/src/features/crm/CrmNav.tsx`
- Public booking:
  - `apps/web/src/features/reservations/PublicReservationPage.tsx`
- Integraciones Meta:
  - `apps/web/src/features/integrations/IntegrationsPage.tsx`
  - `apps/api/src/modules/integrations/meta/*`

Pendiente para cerrar evidencia visual final:

- capturas actuales de:
  - dashboard admin
  - portal cliente
  - flujo movil de reserva
  - disponibilidad
  - contactos
  - integraciones/eventos Meta

## Conclusiones Operativas

1. La base tecnica de VitaHub es real y no simulada en sus flujos nucleares de reservas, CRM y roles.
2. Fase 0 esta suficientemente madura para seguir consolidando entorno, permisos y estructura multi-cliente.
3. Fase 1 ya tiene flujo operativo usable de reserva -> contacto -> asistencia, pero aun no debe declararse cerrada al 100%.
4. El mayor riesgo funcional ya no es "si existe sistema", sino "si esta lo bastante acotado y separado para presentarse con claridad".
5. Para produccion final faltan como minimo:
   - Meta real validado;
   - limpieza de alcance visual;
   - ultima pasada completa de QA manual por rol.

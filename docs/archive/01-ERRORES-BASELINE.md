# 01. Errores Baseline

ESTADO: HISTORICO - RESUELTO
FECHA VERIFICACION: `2026-07-17`
COMMIT VERIFICADO: `29fc25ed78ce0ada35a4828fe784a58e6e6a3193`
FUENTE: ejecucion real de comandos del proyecto

| ID | Comando | Error | Archivo | Linea | Causa | Bloqueante | Prioridad | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| BASE-001 | `npm run build:api` | `TS2307 Cannot find module` | `apps/api/src/core/jobs/cron/meta-lead-recovery.job.ts` | 4-7 | Rutas relativas incorrectas tras mover/crear modulos Meta e `shared` | Si | P0 | Resuelto |
| BASE-002 | `npm run build:api` | `TS2339 Property 'PIXEL' does not exist` | `apps/api/src/modules/integrations/meta/handlers/lead-converted.handler.ts` | 36 | Enum `IntegrationAccountType` no contiene valor `PIXEL` requerido por CAPI | Si | P0 | Resuelto |
| BASE-003 | `npm run build:web` | `TS2307 Cannot find module '../../../../core/api'` | `apps/web/src/features/crm/components/LeadDetailDrawer.tsx` | 2 | Imports relativos incorrectos en componente CRM | Si | P0 | Resuelto |
| BASE-004 | `npm run build:web` | `TS2307 Cannot find module '../../../../shared/StatusBadge'` | `apps/web/src/features/crm/components/LeadDetailDrawer.tsx` | 3 | Imports relativos incorrectos en componente CRM | Si | P0 | Resuelto |
| BASE-005 | `npm run build:web` | `TS6133 declared but never read` | `apps/web/src/features/crm/LeadsPage.tsx` | 125 | Query de oportunidades no usada | Si | P0 | Resuelto |
| BASE-006 | `npm run build:web` | `TS6133 declared but never read` | `apps/web/src/features/crm/LeadsPage.tsx` | 131 | Query de interacciones no usada | Si | P0 | Resuelto |
| BASE-007 | `npm run build:web` | `TS6133 declared but never read` | `apps/web/src/features/crm/LeadsPage.tsx` | 137 | Mutation de export no usada | Si | P0 | Resuelto |
| BASE-008 | `npm run build:web` | `TS6133 declared but never read` | `apps/web/src/features/crm/LeadsPage.tsx` | 141 | Mutation de anonimizado no usada | Si | P0 | Resuelto |
| BASE-009 | `npm run lint:web` | warnings `no-unused-vars` | `apps/web/src/features/crm/LeadsPage.tsx` | 125,131,137,141 | Mismo origen que los errores de build web | No | P1 | Resuelto |

## Resultado general del baseline historico

- Backend: no compila
- Frontend: no compila
- Tests API: pasan
- Riesgo: falso sentido de estabilidad por suite de tests verde con build roto

## Cierre verificado

El `2026-07-17` se repitio la validacion sobre el estado actual: `build:cpanel`, `lint:api`, `lint:web` y `test:api` finalizaron correctamente; la suite API paso `152/152` pruebas y `npm audit --omit=dev` reporto `0` vulnerabilidades.

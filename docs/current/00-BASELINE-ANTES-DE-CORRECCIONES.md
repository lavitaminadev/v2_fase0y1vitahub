# 00. Baseline Antes de Correcciones

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-16`
COMMIT VERIFICADO: `29fc25ed78ce0ada35a4828fe784a58e6e6a3193`
FUENTE: repositorio local + ejecucion real de comandos

## Contexto Git

- Rama actual: `main`
- Workspace: sucio
- Observacion: existe una gran cantidad de cambios previos y archivos nuevos en progreso; esta fase trabaja encima de ese estado sin revertir cambios ajenos.

## Stack real detectado

- Node: `v24.18.0`
- npm: `11.16.0`
- Workspace manager: `npm workspaces`
- Backend: NestJS `11.1.28` + TypeORM `0.3.19` + MySQL
- Frontend: React `19.2.7` + Vite `8.1.4`
- Shared package: `packages/shared`

## Configuracion activa observada

- Root scripts definidos en `package.json`
- API scripts definidos en `apps/api/package.json`
- Web scripts definidos en `apps/web/package.json`
- Version Meta configurada por variable de entorno cuando existe, con fallback visto en codigo a `v23.0`

## Estado actual reproducido

- `build:api`: FAIL
- `build:web`: FAIL
- `lint:api`: FAIL
- `lint:web`: PASS con warnings
- `test:api`: PASS

## Errores relevantes del baseline

- Imports rotos en `apps/api/src/core/jobs/cron/meta-lead-recovery.job.ts`
- Enum incompleto o inconsistente para cuenta Pixel en `lead-converted.handler.ts`
- Imports relativos rotos en `apps/web/src/features/crm/components/LeadDetailDrawer.tsx`
- Variables no usadas que rompen `tsc` en `apps/web/src/features/crm/LeadsPage.tsx`

## Builds generados / artefactos observados

- Existen htmls y artefactos sueltos en raiz (`crm.html`, `dashboard.html`, `index.html`, etc.)
- Existe abundante documentacion legacy y auditorias previas en `docs/`

## Documentacion legacy detectada

- `docs/auditoria-entrega/`
- `docs/auditoria-entrega-v2/`
- `docs/gap-analysis-vs-maestro.md`
- `docs/maestro-alignment-2026-07-16.md`
- `docs/crm-meta-roadmap.md`

## Pruebas actuales

- `npm run test:api` ejecutado con resultado PASS
- 24 archivos de test
- 97 tests aprobados

## Observacion clave

El sistema no esta en estado estable aun cuando los tests API pasen, porque el build backend y frontend fallan en archivos directamente relacionados con CRM y Meta.

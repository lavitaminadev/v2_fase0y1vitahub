# Migración: Reorganización del Repositorio VITAHUB

**Fecha:** 2026-07-15
**Objetivo:** Hacer el repo clonable directamente en `/home/mbarrios/VITAHUB` (iHosting) con `app.js` en raíz, manteniendo modularidad y compatibilidad con Node 20.20.2 + Phusion Passenger + cPanel.

## Cambios Realizados

### Fase 1: Foundation (configs + raíz)
| Archivo | Cambio | Motivo |
|---------|--------|--------|
| `app.js` | **CREADO** | Entry point de Phusion Passenger. Requiere `apps/api/dist/main` |
| `.gitignore` | Actualizado | Añadido `build/`, `.turbo`, `.env.local`, `.env.production`, `coverage/`, `*.tsbuildinfo` |
| `package.json` | Actualizado | Añadido script `start:passenger`, workspace `packages/*`, `migration:run`, `migration:revert` |
| `.env.example` | Actualizado | Añadido `CORS_ORIGIN`, `JWT_REFRESH_EXPIRES_IN`, `BCRYPT_ROUNDS` |

### Fase 2: Limpieza de directorios vacíos/stale
| Ruta eliminada | Motivo |
|----------------|--------|
| `packages/contracts/` | Vacío (0 archivos) |
| `packages/ui/` | Vacío (0 archivos) |
| `packages/validation/` | Vacío (0 archivos) |
| `apps/api/prisma/` | Vacío — el proyecto usa TypeORM, no Prisma |
| `apps/api/src/shared/` | Vacío — tipos compartidos están en `packages/shared/` |
| `apps/web/src/layout/` | Vacío — `AppLayout` usa `shared/Layout` directamente |
| `apps/api/src/modules/integrations/billing/` | Vacío |
| `apps/api/src/modules/integrations/calendar/` | Vacío |
| `apps/api/src/modules/integrations/core/` | Vacío |
| `apps/api/src/modules/integrations/drive/` | Vacío |
| `apps/api/src/modules/integrations/generic/` | Vacío |
| `apps/api/src/modules/integrations/gmail/` | Vacío |
| `apps/api/src/modules/integrations/google/` | Vacío |
| `apps/api/src/modules/integrations/reservations/` | Vacío |

### Fase 3: Renombres
| Ruta anterior | Ruta nueva | Motivo |
|---------------|------------|--------|
| `packages/shared-types/` | `packages/shared/` | Nombre más corto y semántico |
| `@vitahub/shared-types` | `@vitahub/shared` | Consistente con el directorio |

### Fase 4: Features frontend vacías
| Ruta eliminada | Motivo |
|----------------|--------|
| `apps/web/src/features/dashboards/` | Vacío — la feature activa es `dashboard/` |
| `apps/web/src/features/audiovisual/` | Vacío — sin implementación |

## Estado Post-Migración

### Builds verificados
- `apps/api`: `npm run build` → OK (tsc compila sin errores)
- `apps/web`: `npm run build` → OK (tsc + vite build, 169 módulos)

### Lo que NO se modificó (intencionalmente)
- Estructura de módulos backend (`modules/{dominio}/`) — funciona y es modular
- Estructura de features frontend (`features/{feature}/`) — funciona y es plana
- Core transversal (`core/auth`, `core/tenancy`, etc.) — arquitectura correcta
- Integraciones con contenido (`integrations/meta/`, `integrations/oauth/`) — tienen código real
- `infrastructure/` — scripts de deploy, docker, monitoreo
- `database/` — seeds, diagramas, documentación
- `docs/` — documentación existente
- `skills/` — skills de opencode (no del proyecto)

## Fase 5: Correcciones CRITICAL + HIGH (15-Jul 2026, tarde)

### Backend — Relaciones TypeORM
| Entidad | Relación agregada |
|---------|------------------|
| `Contract` | `@ManyToOne(() => Organization)`, `@ManyToOne(() => Client)` |
| `Onboarding` | `@ManyToOne(() => Client)`, `@ManyToOne(() => Organization)`, `@ManyToOne(() => User)` (assignee) |
| `Brief` | `@ManyToOne(() => Organization)`, `@ManyToOne(() => Client)` |
| `Document` | `@ManyToOne(() => Organization)`, `@ManyToOne(() => Client)`, `@ManyToOne(() => User)` (uploader) |
| `Notification` | `@Column(organization_id)`, `@ManyToOne(() => Organization)`, `@ManyToOne(() => User)` |

### Backend — XP Consolidation
- `XPService.registerDelivery/registerDesignerErrorPenalty` ahora delegan a `RegisterXpUseCase` (único punto de escritura)
- `RegisterXpUseCase.executeDelivery` acepta `description` y `metadata` opcionales

### Backend — Dead Code Removed
- `apps/api/src/core/tenancy/tenancy.middleware.ts` — duplicado de `tenant.middleware.ts`
- `apps/api/src/core/tenancy/base.entity.ts` — ninguna entidad lo extendía

### Frontend — Error Boundary + Lazy Loading
- Creado `ErrorBoundary` (class component) en `core/ErrorBoundary.tsx`
- Envuelve toda la app en `App.tsx` → evita white screen en runtime errors
- `router.tsx` migrado a `React.lazy()` + `Suspense` para todas las page components
- Cada página se code-splittea en su propio chunk (de 0.5–4 kB c/u)
- Creado `NotFoundPage` en `features/not-found/NotFoundPage.tsx` para ruta `*`

### Frontend — PWA + SEO
- `index.html`: `<html lang="es">`, título `VITAHUB`, meta tags description/OG/theme-color
- `vite.config.ts`: PWA manifest corregido (`display: standalone`, `start_url: /`, `background_color`, icons 192x192 + 512x512 SVG)
- Creados iconos PWA: `public/icon-192x192.svg`, `public/icon-512x512.svg`

### Frontend — Security
- `SettingsPage`: eliminado `token` del store → ya no se muestra JWT en UI

### Frontend — Infra
- Creado `apps/web/.env.example`

### Infra
- Creado `.dockerignore` en raíz

### Builds verificados
- `apps/api`: `npm run build` → OK (tsc)
- `apps/web`: `npm run build` → OK (tsc + vite build, PWA generado)
- `npm run test --workspace=apps/api` → **12 test files, 74 tests passed**

### Próximos pasos sugeridos
1. Implementar contenido en `packages/shared/` (types ya existen)
2. Agregar integraciones reales en los módulos backend vacíos
3. Configurar Passenger en cPanel apuntando a la raíz del repo
4. Servir frontend compilado (`apps/web/dist/`) desde nginx/apache
5. Auditoría de dependencias (Dependabot)
6. Agregar tests unitarios faltantes (billing, catalog, contracts, onboarding)
7. Agregar páginas frontend para: billing, contracts, catalog, documents, knowledge, gamification

# VITAHUB — Sistema de Gestión de Agencia

Backend NestJS + Frontend React/PWA + MySQL. Multi-tenant agency management platform for production workflows, CRM, design budget tracking, gamification, and client collaboration.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React/Vite/PWA)     │
│  apps/web                                       │
└──────────────────────┬──────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────┐
│                   API (NestJS 10)                │
│  apps/api/src                                    │
│  ├── core/        Auth, tenancy, audit, params   │
│  ├── modules/     Business domains               │
│  └── infrastructure/  Migrations, config         │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       MySQL 8+     Redis 7     Google Drive / Meta API
```

## Tech Stack

- **Backend:** NestJS 10, TypeORM, MySQL 8+, JWT Auth, Multi-tenancy
- **Frontend:** React 19, Vite 5, React Router 7, TanStack Query, Zustand, PWA
- **Production deploy:** iHosting/cPanel via `.cpanel.yml` + Phusion Passenger — see [`docs/deployment/ihosting.md`](docs/deployment/ihosting.md)
- **CI/CD:** GitHub Actions (`.github/`)

> Docker Compose, Redis, and the Prometheus/Grafana monitoring stack exist under `infrastructure/` as an optional local-dev alternative — they are **not** wired into the running application (health check reports `not_configured` when `REDIS_URL` is unset) and are not the production path.

## Quick Start

### Windows local preparado

Este workspace incluye MariaDB portatil en `.local/`, un `.env` local ignorado por Git y datos demostrativos. No requiere Docker ni instalar un servicio de Windows.

```powershell
npm.cmd run local:start
```

Abrir `http://localhost:5173` e ingresar con:

```text
Administrador: admin@vitahub.local / AdminLocal_2026!
Cliente:       cliente@vitahub.local / ClienteLocal_2026!
Equipo:        operaciones@vitahub.local / EquipoLocal_2026!
```

Comandos de apoyo:

```powershell
npm.cmd run local:status
npm.cmd run local:seed
npm.cmd run local:stop
```

### With Docker (recommended)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your settings

# 2. Start all services
docker-compose -f infrastructure/docker-compose.yml up -d

# 3. Run migrations
docker-compose exec api npm run migration:run
```

### Manual setup

```bash
# 1. Database
mysql -u root -p < database/seeds/seed.sql

# 2. API
cd apps/api
cp .env.example .env
npm install
npm run start:dev

# 3. Web (separate terminal)
cd apps/web
npm install
npm run dev
```

## Project Structure

```
vitahub/
├── app.js                     # Passenger entry point
├── apps/
│   ├── api/src/               # NestJS backend
│   │   ├── core/              # Auth, tenancy, audit, parameters
│   │   ├── modules/           # Business domains
│   │   │   ├── organizations/
│   │   │   ├── clients/
│   │   │   ├── crm/
│   │   │   ├── production/
│   │   │   ├── design-budget/
│   │   │   ├── gamification/
│   │   │   ├── meetings/
│   │   │   ├── content/
│   │   │   ├── billing/
│   │   │   ├── catalog/
│   │   │   ├── approvals/
│   │   │   ├── briefs/
│   │   │   ├── contracts/
│   │   │   ├── documents/
│   │   │   ├── onboarding/
│   │   │   ├── uploads/
│   │   │   ├── knowledge/
│   │   │   ├── reports/
│   │   │   ├── dashboards/
│   │   │   └── integrations/  # Meta, OAuth, etc.
│   │   └── infrastructure/    # Migrations, data-source
│   └── web/src/               # React + Vite + PWA frontend
│       ├── core/              # Router, API client, auth, layout
│       ├── features/          # Dashboard, Clients, CRM, etc.
│       └── shared/            # Reusable UI components
├── database/
│   ├── diagrams/
│   ├── documentation/
│   └── seeds/
├── infrastructure/
│   ├── docker-compose.yml
│   ├── deployment/            # Dockerfiles, nginx, PM2
│   ├── ihosting/              # iHosting/cPanel deploy scripts
│   ├── monitoring/            # Prometheus + Grafana
│   ├── scripts/               # Backup & seed
│   └── cron/
├── packages/
│   └── shared/                # @vitahub/shared types & interfaces
├── docs/
└── .github/workflows/
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment | development |
| PORT | API port | 3000 |
| DB_HOST | MySQL host | localhost |
| DB_PORT | MySQL port | 3306 |
| DB_USERNAME | MySQL user | vitahub |
| DB_PASSWORD | MySQL password | required |
| DB_DATABASE | MySQL database | vitahub |
| REDIS_URL | Optional — only used by the health check; the app runs fully without it | not configured |
| JWT_SECRET | JWT signing secret | — |
| JWT_EXPIRES_IN | Access JWT expiry | 15m |
| JWT_REFRESH_EXPIRES_IN | Rotating browser session expiry | 7d |
| UPLOAD_DIR | Local file upload directory | ./uploads |

## Development Commands

```bash
npm run dev:api          # Start API in watch mode
npm run dev:web          # Start web in watch mode
npm run build:api        # Build API
npm run build:web        # Build web
npm run test:api         # Run API tests
npm run lint:api         # Lint API
```

## Database Commands

```bash
npm run migration:generate -- apps/api/src/infrastructure/migrations/MigrationName
npm run migration:run
npm run migration:revert
```

## Deployment

**Production (iHosting/cPanel):** fully documented in [`docs/deployment/ihosting.md`](docs/deployment/ihosting.md). Short version — cPanel's `Git Version Control` pulls the repo and runs `.cpanel.yml`, which builds `apps/api` and `apps/web` and restarts Phusion Passenger (`app.js` is the entry point, reading `apps/api/dist/main.js`).

```bash
npm run build:cpanel          # build shared + api + web
npm run check:production-env  # validate required env vars are set
npm run migration:run         # run pending DB migrations (manual, controlled)
```

Docker Compose / PM2 / Nginx / Prometheus-Grafana under `infrastructure/` are a legacy/local-dev alternative, not the production path — see [`docs/DEPLOY.md`](docs/DEPLOY.md) if you need them for local testing.

### Backup
```bash
./infrastructure/scripts/backup.sh ./backups
```

## Business Rules (ported from Lavitamina V2)

- **UD Calculator** — Cost matrix by piece type
- **XP Calculator** — XP with speed/quality bonuses
- **Naming Validator** — File naming convention validation
- **Production Workflow** — Assign → Submit → Reject → Deliver (transactional with events)
- **Monthly UD Budget** — Reserve → Consume, non-cumulative
- **Multi-tenancy** — All entities scoped by organizationId with automatic middleware filtering
## Integration Notes

- Meta OAuth now uses the backend endpoint `/integrations/meta/auth-url`, persists the callback from `/integrations/meta/callback`, and stores the long-lived token in `integrations.config`.
- Google OAuth now uses `/integrations/google/auth-url`, persists the callback from `/integrations/google/callback`, and stores both access token and refresh token in `integrations.config`.
- The integration cards refresh credentials through `/integrations/meta/:id/refresh` and `/integrations/google/:id/refresh`, so the UI no longer depends on placeholder actions.
- The documents module now performs real CRUD against `/documents`, including client selection, status, file URL, Drive file id, and tags.

## Extra Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| META_APP_ID | Meta app client id | — |
| META_APP_SECRET | Meta app client secret | — |
| META_GRAPH_API_VERSION | Meta Graph API version | v23.0 |
| META_WEBHOOK_VERIFY_TOKEN | Meta webhook verification token | — |
| GOOGLE_CLIENT_ID | Google OAuth client id | — |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret | — |
| META_TEST_EVENT_CODE | Meta Events Manager test code | - |
| META_CONVERSIONS_ACCESS_TOKEN | Dedicated server-side Conversions API token | - |
| API_PUBLIC_URL | Public API URL including `/api` | - |
| INTEGRATION_ENCRYPTION_KEY | 32-byte integration encryption key | - |
| OAUTH_STATE_SECRET | OAuth callback state signing secret | - |
| CRM_LEAD_RETENTION_DAYS | Lead retention review period in days | - |
| VITE_API_URL | Frontend API base URL | /api |

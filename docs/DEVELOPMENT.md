# Guía de Desarrollo - VITAHUB

## Prerrequisitos

- **Node.js** `20.20.2` (ver `.nvmrc`)
- **MySQL** `8.0`
- **Redis** `7.x` (opcional, para caché)
- **npm** `>=9`

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-org/hubvit.git
cd hubvit

# 2. Usar versión correcta de Node
nvm use

# 3. Instalar todos los workspaces desde el lockfile raíz
npm ci

# 4. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores locales
```

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Entorno |
| `PORT` | `3000` | Puerto del API |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido CORS |
| `DB_HOST` | `localhost` | Host MySQL |
| `DB_PORT` | `3306` | Puerto MySQL |
| `DB_USERNAME` | `vitahub` | Usuario MySQL |
| `DB_PASSWORD` | required | Contraseña MySQL |
| `DB_DATABASE` | `vitahub` | Nombre BD |
| `REDIS_HOST` | `localhost` | Host Redis |
| `REDIS_PORT` | `6379` | Puerto Redis |
| `JWT_SECRET` | generado por proceso en desarrollo; obligatorio en producción | Secreto JWT |
| `JWT_EXPIRES_IN` | `15m` | Expiración del token de acceso |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Expiración de la sesión rotatoria |
| `STORAGE_DRIVER` | `local` | Driver de archivos |
| `STORAGE_PATH` | `./storage` | Ruta de almacenamiento |
| `AI_PROVIDER` | `openai` | Proveedor IA |
| `AI_API_KEY` | - | API Key IA |
| `AI_MODEL` | `gpt-4` | Modelo IA |

## Ejecutar la API

```bash
# Development (hot reload)
cd apps/api
npm run start:dev

# Producción
npm run build
npm run start
```

## Ejecutar el Frontend (Web)

```bash
cd apps/web
npm run dev
```

## Ejecutar Tests

```bash
# Tests de la API
cd apps/api
npm run test

# Tests desde la raíz
npm run test:api
```

## Migraciones

```bash
# Development: las entidades se sincronizan automáticamente
# (synchronize: true en development)

# Producción: ejecutar migraciones
cd apps/api
npx typeorm migration:run -d dist/infrastructure/database-data-source.js
```

## Linting

```bash
cd apps/api
npm run lint

# Desde raíz
npm run lint:api
```

## Docker Setup

```bash
# Iniciar servicios (MySQL + Redis)
cd infrastructure
docker-compose up -d mysql redis

# Iniciar todo (API + Web + BD + Redis)
docker-compose up -d
```

## Scripts Disponibles (raíz)

| Comando | Descripción |
|---------|-------------|
| `npm run dev:api` | Iniciar API en desarrollo |
| `npm run dev:web` | Iniciar Web en desarrollo |
| `npm run build:api` | Compilar API |
| `npm run build:web` | Compilar Web |
| `npm run lint:api` | Lint API |
| `npm run test:api` | Tests API |

## Estructura de Commits

```
feat: descripción del cambio
fix: descripción del bug
chore: tareas de mantenimiento
docs: cambios en documentación
refactor: refactorización de código
```
## Variables adicionales para integraciones

| Variable | Default | DescripciÃ³n |
|---------|---------|-------------|
| `META_APP_ID` | - | App ID de Meta |
| `META_APP_SECRET` | - | App Secret de Meta |
| `META_GRAPH_API_VERSION` | `v23.0` | VersiÃ³n del Graph API de Meta |
| `META_WEBHOOK_VERIFY_TOKEN` | - | Token de verificaciÃ³n del webhook |
| `META_TEST_EVENT_CODE` | - | Codigo de Test Events para validar Conversions API sin afectar datos reales |
| `META_CONVERSIONS_ACCESS_TOKEN` | - | Token dedicado de CAPI en el servidor; nunca se envia al navegador |
| `API_PUBLIC_URL` | - | URL HTTPS publica de la API, incluida la base `/api` |
| `INTEGRATION_ENCRYPTION_KEY` | - | Clave de 32 bytes en base64 o 64 caracteres hex; obligatoria en produccion |
| `OAUTH_STATE_SECRET` | - | Secreto para vincular y expirar callbacks OAuth; si falta usa `JWT_SECRET` |
| `CRM_LEAD_RETENTION_DAYS` | - | Dias hasta revisar/anonimizar leads segun politica aprobada |
| `GOOGLE_CLIENT_ID` | - | Client ID de Google |
| `GOOGLE_CLIENT_SECRET` | - | Client Secret de Google |
| `VITE_API_URL` | `/api` | Base URL del frontend hacia la API |

## Flujos operativos relevantes

- Meta: `/integrations` solicita la URL OAuth al backend, abre popup y `/integrations/meta/callback` persiste la integraciÃ³n real en la tabla `integrations`.
- Google: `/integrations/google/auth-url` abre OAuth y `/integrations/google/callback` guarda access token y refresh token reales en base de datos.
- Documentos: `/documents` ya opera con la API real para listar, crear, editar y eliminar documentos; la creaciÃ³n requiere `clientId`.

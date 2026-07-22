# Deploy en iHosting (cPanel + Phusion Passenger)

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-17`
FUENTE: estrategia oficial de despliegue para VITAHUB en iHosting

## Estrategia Oficial

La unica estrategia soportada para produccion es:

- repositorio gestionado por `Git Version Control` de cPanel;
- backend NestJS ejecutado por `Phusion Passenger`;
- frontend React/Vite compilado y publicado como estatico en `public_html`;
- despliegue automatizado por `.cpanel.yml` desde la raiz del repositorio;
- migraciones ejecutadas manualmente y de forma controlada.

## Requisitos

- Node.js `20.20.2` en cPanel.
- repositorio Git gestionado desde cPanel.
- `app.js` en la raiz del repo.
- `.cpanel.yml` versionado en la raiz del repo.
- `.env` productivo configurado en el servidor.
- working tree limpio antes de publicar cambios.

## Flujo Recomendado

1. Subir cambios a GitHub.
2. En cPanel, usar `Update from Remote`.
3. En cPanel, usar `Deploy HEAD Commit`.
4. cPanel ejecuta `.cpanel.yml`.
5. Passenger reinicia la API.
6. Si corresponde, correr `npm run migration:run` manualmente.

## Que Hace `.cpanel.yml`

El flujo oficial ejecuta:

1. `npm ci --include=dev`
2. `npm run build:shared`
3. `npm run build:api`
4. `npm run build:web`
5. valida el `.env` productivo y los artefactos compilados
6. crea almacenamiento privado en `$HOME/vitahub_storage` y `$HOME/vitahub_uploads`
7. copia `apps/web/dist/` a `$HOME/public_html`
8. crea `tmp/restart.txt` y toca `app.js` para reiniciar Passenger

## Passenger

Configurar en cPanel:

- Application root: raiz del repositorio
- Startup file: `app.js`
- Node version: `20.20.2`

`app.js` arranca la API compilada desde `apps/api/dist/main.js`.

## Frontend

El frontend no lo sirve Passenger.

Se publica como archivos estaticos en:

```bash
$HOME/public_html
```

## Migraciones

Se ejecutan manualmente:

```bash
npm run migration:run
```

No se recomienda meter migraciones automaticamente dentro de `.cpanel.yml` hasta cerrar completamente el flujo productivo.

Para Reservas deben aparecer, en este orden:

```text
Reservations1710000000017
ReservationsHardening1710000000018
OperationalSchema1710000000019
```

El cargador de entorno usa siempre el `.env` de la raiz, tanto al iniciar Passenger como al ejecutar migraciones.

## Dominio y API

La configuracion recomendada evita conflictos entre Apache estatico y Passenger:

- frontend: `https://app.tudominio.cl` o el dominio principal;
- API Passenger: `https://api.tudominio.cl`;
- `VITE_API_URL=https://api.tudominio.cl/api`;
- `API_PUBLIC_URL=https://api.tudominio.cl/api`;
- `APP_PUBLIC_URL=https://app.tudominio.cl`;
- `CORS_ORIGIN=https://app.tudominio.cl`.

El frontend incluye `.htaccess` para que enlaces directos como `/portal/reservations` y `/book/...` abran correctamente. Si se decide montar Passenger bajo `/api` en el mismo dominio, se debe excluir ese prefijo del rewrite de Apache antes de publicar.

## Variables y secretos

Guardar `.env` en la raiz privada del repositorio, nunca dentro de `public_html`. En File Manager usar permisos `600` cuando el hosting lo permita.

Valores productivos minimos:

```dotenv
NODE_ENV=production
ENABLE_SWAGGER=false
ENABLE_INTERNAL_SCHEDULER=true
ALLOW_PUBLIC_REGISTRATION=false
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=...
DB_PASSWORD=...
DB_DATABASE=...
JWT_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OAUTH_STATE_SECRET=...
INTEGRATION_ENCRYPTION_KEY=...
CORS_ORIGIN=https://app.tudominio.cl
APP_PUBLIC_URL=https://app.tudominio.cl
VITE_API_URL=https://api.tudominio.cl/api
API_PUBLIC_URL=https://api.tudominio.cl/api
UPLOAD_DIR=/home/ACCOUNT/vitahub_uploads
MAX_UPLOAD_BYTES=20971520
TRUST_PROXY_HOPS=1
```

Activar AutoSSL y **Force HTTPS Redirect** para los dominios del frontend y de la API en cPanel. El `.htaccess` del frontend fuerza HTTPS, HSTS y el fallback de React Router; el subdominio Passenger de la API debe mantener también la redirección HTTPS del panel.

La renovacion de sesion se entrega en una cookie `HttpOnly`, `SameSite=Strict` y `Secure` en produccion. Por eso no se debe abrir la aplicacion productiva por HTTP ni desactivar `credentials` en CORS. El frontend conserva el token de acceso solo en memoria y el backend guarda unicamente el hash de la credencial de renovacion.

Crear `UPLOAD_DIR` fuera de `public_html`, con escritura para el proceso de Passenger. `.cpanel.yml` prepara `$HOME/vitahub_uploads`; reemplazar `ACCOUNT` por el usuario real de cPanel en el `.env`. Los archivos temporales nunca deben quedar publicados directamente por Apache.

## Meta y Google

Configurar en las consolas de cada proveedor estas URLs exactas:

```text
Meta OAuth:   https://app.tudominio.cl/integrations/meta/callback
Google OAuth: https://app.tudominio.cl/integrations/google/callback
Meta webhook: https://api.tudominio.cl/api/webhooks/meta
Meta borrado: https://api.tudominio.cl/api/webhooks/meta/data-deletion
```

Variables de Meta:

```dotenv
META_APP_ID=...
META_APP_SECRET=...
META_GRAPH_API_VERSION=v23.0
META_WEBHOOK_VERIFY_TOKEN=...
META_CONVERSIONS_ACCESS_TOKEN=...
META_TEST_EVENT_CODE=...
```

Variables de Google:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_DEVELOPER_TOKEN=...
GOOGLE_LOGIN_CUSTOMER_ID=...
GOOGLE_ADS_API_VERSION=v24
```

`GOOGLE_DEVELOPER_TOKEN` es obligatorio para descubrir y sincronizar Google Ads. La versión queda configurable porque Google retira versiones periódicamente; revisar su calendario oficial antes de cada actualización mayor.

En Meta, suscribir la aplicación a `leadgen` y habilitar los permisos solicitados por el flujo OAuth. En producción, completar la revisión de la aplicación antes de conectar cuentas de clientes que no pertenezcan a los administradores de la app.

La mensajería automática de Instagram no forma parte del flujo principal de Lead Ads. Solo se activa si se definen `CONVERSATION_SERVICE_URL` con HTTPS e `INTERNAL_API_TOKEN` de al menos 32 caracteres; sin esas variables, los mensajes se omiten sin interrumpir la captura de leads.

Generar secretos distintos con Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Usar el primer formato para `JWT_SECRET` y `OAUTH_STATE_SECRET`. El segundo contiene exactamente 32 bytes y corresponde a `INTEGRATION_ENCRYPTION_KEY`. No cambiar esa llave después de conectar Meta o Google: hacerlo impediría descifrar los tokens ya guardados.

Si Passenger corre en mas de un proceso, dejar `ENABLE_INTERNAL_SCHEDULER=false` y configurar un unico cron/worker para evitar trabajos duplicados. En una instalacion inicial de un solo proceso puede quedar en `true` para reintentos de Meta CAPI y tareas internas.

## Estructura Esperada

```text
/home/ACCOUNT/repositories/vitahub/
|-- .cpanel.yml
|-- app.js
|-- package.json
|-- apps/api/dist/main.js
|-- apps/web/dist/
`-- .env
```

## Notas

- Passenger no compila; solo ejecuta `app.js`.
- Si falla el arranque, primero validar que existan `apps/api/dist/main.js` y `apps/web/dist/index.html`.
- Si cambia `.env`, reiniciar Passenger tocando `app.js` o desde cPanel.
- Verificar `GET https://api.tudominio.cl/api/health` antes de probar el frontend.
- Verificar que el registro público continúe deshabilitado y crear usuarios desde Administracion > Usuarios.
- Probar OAuth, descubrimiento, asignación a cliente y una sincronización controlada en Meta y Google antes de activar tareas programadas.
- Los scripts Docker de `infrastructure/` quedan como legacy y no son la ruta oficial de produccion en iHosting.

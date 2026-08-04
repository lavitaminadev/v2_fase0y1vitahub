# Deploy en iHosting (cPanel + Phusion Passenger)

ESTADO: VIGENTE
FECHA VERIFICACION: `2026-07-27`
FUENTE: estrategia oficial de despliegue para VITAHUB en iHosting

## Estrategia oficial

La unica estrategia soportada para produccion es:

- repositorio gestionado por `Git Version Control` de cPanel;
- backend NestJS ejecutado por `Phusion Passenger`;
- frontend React/Vite compilado y publicado como estatico en `public_html`;
- despliegue automatizado por `.cpanel.yml` desde la raiz del repositorio;
- migraciones ejecutadas manualmente y de forma controlada.

## Requisitos

- Node.js `20.20.2` en cPanel;
- repositorio Git gestionado desde cPanel;
- `app.js` en la raiz del repo;
- `.cpanel.yml` versionado en la raiz del repo;
- `.env` productivo configurado en el servidor;
- working tree limpio antes de publicar cambios.

## Flujo recomendado

1. Subir cambios al remoto usado por cPanel.
2. En cPanel, usar `Update from Remote`.
3. En cPanel, usar `Deploy HEAD Commit`.
4. cPanel ejecuta `.cpanel.yml`.
5. Passenger reinicia la API.
6. Si corresponde, correr `npm run migration:run` manualmente.

## Que hace `.cpanel.yml`

El flujo oficial ejecuta:

1. `npm ci --include=dev`
2. `npm run build:cpanel`
3. `npm run check:production-env`
4. valida artefactos compilados
5. crea almacenamiento privado en `$HOME/vitahub_storage`, `$HOME/vitahub_uploads`, `$HOME/vitahub_backups`, `$APP_ROOT/tmp` y `$APP_ROOT/logs`
6. copia `apps/web/dist/` a `$HOME/public_html`
7. crea `tmp/restart.txt` y toca `app.js` para reiniciar Passenger

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

## Tareas programadas (cron)

Instalar las tareas cron que procesan la cola de conversiones Meta CAPI:

```bash
bash scripts/deploy/setup-crontab.sh <CRON_SECRET> https://api.midominio.cl
```

El script exige el origen de la API como segundo argumento y valida que sea `https`. Si el repositorio no esta en `$HOME/vitahub`, indicarlo con `APP_DIR=/ruta/al/repo` delante del comando.

Tareas instaladas:

- `*/5 * * * *` procesa el outbox de conversiones Meta CAPI pendientes.
- `0 * * * *` ejecuta diagnostico de Meta CAPI.
- `10 * * * *` detecta piezas estancadas (`/cron/stale-pieces`).
- `20 * * * *` escanea alertas operativas (`/cron/operational-alerts`).
- `0 */6 * * *` cierra periodos de XP semanales (`/cron/xp-periods`).
- `10 3 * * *` genera ciclos mensuales de cuenta (`/cron/monthly-cycles`).
- `20 3 * * *` envia emails de cobranza de facturas vencidas (`/cron/collection-emails`).
- `30 3 * * *` revisa retencion de datos y anonimiza leads/reservas expirados (`/cron/data-retention`).
- `0 3 * * *` genera backup diario de MySQL (`mysqldump` comprimido) a `$HOME/vitahub_backups` y retiene 30 dias localmente. Sigue pendiente definir almacenamiento externo u offsite.

Estos endpoints son un respaldo del scheduler interno en memoria (`ENABLE_INTERNAL_SCHEDULER=true`): Passenger puede reciclar el proceso Node periodicamente, y un job que solo vive en `setInterval` puede no llegar a ejecutarse nunca en ese ciclo. Cada endpoint usa el mismo lock en memoria que el scheduler interno para evitar solapes dentro del mismo proceso; si ambos mecanismos llegan a correr en procesos distintos al mismo tiempo, cada job esta escrito para tolerarlo (busca por estado/fingerprint antes de actuar), salvo el envio de emails de cobranza, donde una coincidencia exacta en el mismo instante podria duplicar un envio antes de que el primero marque la factura como `overdue`.

Verificar con `crontab -l`. Los logs quedan en `$APP_DIR/logs/`.

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

Activar AutoSSL y **Force HTTPS Redirect** para los dominios del frontend y de la API en cPanel. El `.htaccess` del frontend fuerza HTTPS, HSTS y el fallback de React Router; el subdominio Passenger de la API debe mantener tambien la redireccion HTTPS del panel.

La renovacion de sesion se entrega en una cookie `HttpOnly`, `SameSite=Strict` y `Secure` en produccion. Por eso no se debe abrir la aplicacion productiva por HTTP ni desactivar `credentials` en CORS. El frontend conserva el token de acceso solo en memoria y el backend guarda unicamente el hash de la credencial de renovacion.

Crear `UPLOAD_DIR` fuera de `public_html`, con escritura para el proceso de Passenger. `.cpanel.yml` prepara `$HOME/vitahub_uploads`; reemplazar `ACCOUNT` por el usuario real de cPanel en el `.env`. Los archivos temporales nunca deben quedar publicados directamente por Apache.

## Integraciones activas en Fase 0 / Fase 1

Configurar en las consolas de los proveedores solo las URLs que sigan activas en la fase publicada. Al lunes 27 de julio de 2026, Meta sigue dentro del circuito operativo y Google Ads/OAuth no debe considerarse requisito de salida para el despliegue base en iHosting.

URLs activas:

```text
Meta OAuth:   https://app.tudominio.cl/integrations/meta/callback
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

En Meta, suscribir la aplicacion a `leadgen` y habilitar los permisos solicitados por el flujo OAuth. En produccion, completar la revision de la aplicacion antes de conectar cuentas de clientes que no pertenezcan a los administradores de la app.

La mensajeria automatica de Instagram no forma parte del flujo principal de Lead Ads. Solo se activa si se definen `CONVERSATION_SERVICE_URL` con HTTPS e `INTERNAL_API_TOKEN` de al menos 32 caracteres; sin esas variables, los mensajes se omiten sin interrumpir la captura de leads.

Generar secretos distintos con Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Usar el primer formato para `JWT_SECRET` y `OAUTH_STATE_SECRET`. El segundo contiene exactamente 32 bytes y corresponde a `INTEGRATION_ENCRYPTION_KEY`. No cambiar esa llave despues de conectar Meta: hacerlo impediria descifrar los tokens ya guardados.

Si Passenger corre en mas de un proceso, dejar `ENABLE_INTERNAL_SCHEDULER=false` y configurar un unico cron o worker para evitar trabajos duplicados. En una instalacion inicial de un solo proceso puede quedar en `true` para reintentos de Meta CAPI y tareas internas.

## Estructura esperada

```text
/home/ACCOUNT/repositories/vitahub/
|-- .cpanel.yml
|-- app.js
|-- package.json
|-- apps/api/dist/main.js
|-- apps/web/dist/
`-- .env
```

## Verificacion post-despliegue

```bash
# API responde: 200 si esta operativa, 503 si alguna dependencia falla.
# El detalle (base, memoria, disco) esta en /api/health/details, que exige sesion de
# administracion: la sonda publica no expone informacion de infraestructura.
curl -s -o /dev/null -w "%{http_code}\n" https://api.tudominio.cl/api/health

# Frontend sirve
curl -s -o /dev/null -w "%{http_code}\n" https://app.tudominio.cl

# Cron funciona (requiere CRON_SECRET)
curl -s -X POST https://api.tudominio.cl/api/cron/meta-capi \
  -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" -d '{"limit":10}'
```

## Rollback

```bash
# Revertir la ultima migracion, solo si el cambio la incluyo y se evaluo el impacto
npm run migration:revert

# Volver a desplegar el ultimo commit estable conocido desde Git/cPanel
# usando el flujo normal de Update from Remote + Deploy HEAD Commit
```

Evitar `git reset --hard` en el servidor como procedimiento por defecto.

## Troubleshooting

| Problema | Causa probable | Solucion |
|---|---|---|
| 502 Bad Gateway | Passenger no arranco | Revisar `app.js` y la version de Node configurada en el panel |
| 404 en rutas SPA | Falta `.htaccess` en `public_html` | Confirmar que `apps/web/dist/.htaccess` se copio correctamente |
| Error de conexion a BD | Variables de entorno incorrectas | Verificar `.env` y credenciales de MySQL |
| Timeout en curl de cron | URL o secret incorrecto | Probar el endpoint manualmente antes de instalar el crontab |
| Migraciones fallan | Esquema desactualizado | Correr `migration:run` y revisar el orden esperado arriba |

## Notas

- Passenger no compila; solo ejecuta `app.js`.
- Si falla el arranque, primero validar que existan `apps/api/dist/main.js` y `apps/web/dist/index.html`.
- Si cambia `.env`, reiniciar Passenger tocando `app.js` o desde cPanel.
- Verificar que el registro publico continue deshabilitado y crear usuarios desde Administracion > Usuarios.
- Probar OAuth, asignacion a cliente y una sincronizacion controlada en Meta antes de activar tareas programadas.
- Los scripts Docker de `infrastructure/` quedan como legacy y no son la ruta oficial de produccion en iHosting; sirven solo para desarrollo o pruebas locales con Docker si se prefiere a `scripts/local/`.
- Usar `docs/deployment/DEPLOY-CHECKLIST-IHOSTING.md` como checklist breve de salida antes de publicar.

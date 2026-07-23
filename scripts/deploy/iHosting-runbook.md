# Runbook despliegue iHosting — VitaHub

## 1. Requisitos previos

- Node.js ≥ 20.19.0 (verificar con `node -v`)
- npm ≥ 11.16.0 (viene con Node)
- Acceso SSH al hosting
- Dominio apuntando a iHosting (ej. `vitahub.cl`)
- Certificado SSL activo (AutoSSL o manual)

## 2. Estructura de carpetas esperada

```
~/vitahub/              # Raíz de la aplicación (git clone)
~/public_html/           # Frontend (web dist) — apuntado por el dominio
```

## 3. Build

```bash
# En local o en CI:
npm ci
npm run build:cpanel    # Build shared + api + web
```

Esto produce:
- `apps/api/dist/` — backend compilado
- `apps/web/dist/` — frontend compilado

## 4. Despliegue — Backend (API)

```bash
ssh usuario@vitahub.cl
cd ~/vitahub
git pull origin main
npm ci --omit=dev       # Solo dependencias de producción
npm run build:cpanel    # Re-build
cp .env.base .env       # Ajustar variables si es necesario
npm run migration:run   # Ejecutar migraciones pendientes
```

### Variables de entorno requeridas (`.env`)

| Variable | Descripción |
|---|---|
| `CRON_SECRET` | Secreto compartido para endpoints cron |
| `APP_PUBLIC_URL` | `https://vitahub.cl` |
| `VITE_APP_PUBLIC_URL` | `https://vitahub.cl` |
| `CRON_URL` | `https://vitahub.cl/api/cron` |
| `DB_HOST` | Host MySQL |
| `DB_PORT` | Puerto MySQL |
| `DB_USERNAME` | Usuario DB |
| `DB_PASSWORD` | Password DB |
| `DB_DATABASE` | `vitahub` |
| `META_CONVERSIONS_ACCESS_TOKEN` | Token CAPI (opcional, por cliente) |

### Passenger (Node.js app)

iHosting usa Passenger por defecto. Si no, configurar `app.js` en la raíz:

```js
require('./apps/api/dist/main');
```

Y en el panel de iHosting:
- Tipo de aplicación: Node.js
- Punto de entrada: `app.js`
- Versión de Node: 22.x

## 5. Despliegue — Frontend (Web)

```bash
# Copiar dist a public_html
npm run deploy:web:cpanel
```

O manualmente:

```bash
cp -r apps/web/dist/* ~/public_html/
```

Verificar que `public_html/.htaccess` tenga redirect a SPA:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## 6. Tareas programadas (Cron)

```bash
bash scripts/deploy/setup-crontab.sh <CRON_SECRET>
```

Las tareas instaladas:
- `*/5 * * * *` — Meta CAPI outbox (procesa conversiones pendientes)
- `0 * * * *` — Meta CAPI diagnostics
- `0 4 * * *` — Purga de leads expirados (cuando exista endpoint)

Verificar con: `crontab -l`

## 7. Post-despliegue

```bash
# Verificar que el API responde
curl -s https://vitahub.cl/api/health

# Verificar que el frontend sirve
curl -s -o /dev/null -w "%{http_code}" https://vitahub.cl

# Verificar migraciones
cd ~/vitahub && npm run migration:run

# Verificar cron
curl -s -X POST https://vitahub.cl/api/cron/meta-capi \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'

# Verificar variables de entorno
npm run check:production-env
```

## 8. Rollback

```bash
# Revertir última migración
npm run migration:revert

# Volver a commit anterior
git reset --hard HEAD~1
npm run build:cpanel

# Restaurar frontend
npm run deploy:web:cpanel
```

## 9. Troubleshooting común

| Problema | Causa | Solución |
|---|---|---|
| 502 Bad Gateway | Passenger no arrancó | Revisar `app.js` y versión de Node en panel |
| 404 en rutas SPA | Falta .htaccess | Agregar rewrite rules en `public_html/` |
| Error de conexión DB | Variables de entorno | Verificar `.env` y credenciales |
| CURL timeout en cron | URL incorrecta o secret | Probar endpoint manualmente primero |
| Migraciones fallan | DB schema desactualizado | Ejecutar `migration:run` con `--show-sql` para debug |

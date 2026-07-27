#!/bin/bash
# Configura las entradas crontab para los endpoints cron de VitaHub en iHosting.
#
# Uso: bash scripts/deploy/setup-crontab.sh <CRON_SECRET> <URL_BASE_API>
#   CRON_SECRET     — valor de CRON_SECRET configurado en .env
#   URL_BASE_API    — origen publico de la API, por ejemplo https://api.midominio.cl
#
# El outbox de Meta CAPI solo se procesa si estas tareas quedan instaladas y
# apuntando al dominio correcto: sin eso las conversiones se acumulan sin enviarse
# y no aparece ningun error visible.

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Uso: $0 <CRON_SECRET> <URL_BASE_API>"
  echo "  CRON_SECRET   — valor de CRON_SECRET configurado en .env"
  echo "  URL_BASE_API  — origen publico de la API, ej: https://api.midominio.cl"
  exit 1
fi

SECRET="$1"
API_ORIGIN="${2%/}"
APP_DIR="${APP_DIR:-$HOME/vitahub}"

case "$API_ORIGIN" in
  https://*) ;;
  *)
    echo "Error: la URL base debe ser https. Recibido: $API_ORIGIN" >&2
    echo "Los eventos de conversion llevan datos personales y el endpoint exige HTTPS." >&2
    exit 1
    ;;
esac

CRON_URL="$API_ORIGIN/api/cron"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Error: no se encontro $APP_DIR/.env" >&2
  echo "Define APP_DIR=/ruta/al/repo si el proyecto esta en otra carpeta." >&2
  exit 1
fi

mkdir -p "$APP_DIR/logs"

# Las entradas previas de VitaHub se eliminan antes de reinstalar: correr el script
# dos veces no debe duplicar tareas ni dejar apuntando a un dominio antiguo.
EXISTING="$(crontab -l 2>/dev/null | grep -v '# VitaHub' | grep -v "$CRON_URL" | grep -v 'vitahub/logs/cron-' || true)"

echo "Instalando tareas cron para VitaHub..."
echo "  API:        $CRON_URL"
echo "  Directorio: $APP_DIR"

{
  printf '%s\n' "$EXISTING"
  cat <<EOF

# VitaHub — Meta CAPI outbox (cada 5 minutos)
*/5 * * * * curl -s -X POST "$CRON_URL/meta-capi" -H "x-cron-secret: $SECRET" -H "Content-Type: application/json" -d '{"limit":50}' -m 60 >> $APP_DIR/logs/cron-meta-capi.log 2>&1

# VitaHub — Meta CAPI diagnostics (cada hora a minuto 0)
0 * * * * curl -s "$CRON_URL/meta-capi/diagnostics" -H "x-cron-secret: $SECRET" -m 30 >> $APP_DIR/logs/cron-meta-capi-diag.log 2>&1

# VitaHub — Backup diario de la base de datos (03:00, retiene 30 dias localmente)
# Guarda en \$HOME/vitahub_backups (fuera de public_html, mismo criterio que vitahub_storage/vitahub_uploads).
# Pendiente: decidir almacenamiento externo/offsite — ver docs/decisions/pending-business-decisions.md #15.
0 3 * * * set -a && . $APP_DIR/.env && set +a && RETENTION_DAYS=30 bash $APP_DIR/infrastructure/scripts/backup.sh \$HOME/vitahub_backups >> $APP_DIR/logs/cron-backup.log 2>&1
EOF
} | crontab -

echo "Crontab actualizado."
echo "Verifica con: crontab -l"
echo "Los logs se escriben en: $APP_DIR/logs/"
echo
echo "Comprobacion rapida (debe responder sin error):"
echo "  curl -s -X POST \"$CRON_URL/meta-capi\" -H \"x-cron-secret: \$CRON_SECRET\" -H 'Content-Type: application/json' -d '{\"limit\":1}'"

#!/bin/bash
# Configura las entradas crontab para los endpoints cron de VitaHub en iHosting.
# Uso: bash scripts/deploy/setup-crontab.sh <CRON_SECRET>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <CRON_SECRET>"
  echo "  CRON_SECRET  — valor de CRON_SECRET configurado en .env"
  exit 1
fi

SECRET="$1"
CRON_URL="${CRON_URL:-https://vitahub.cl/api/cron}"
NODE="${NODE:-$(which node || echo /usr/local/bin/node)}"
APP_DIR="${APP_DIR:-$HOME/vitahub}"

echo "Instalando tareas cron para VitaHub..."
echo "URL base: $CRON_URL"
echo "Directorio: $APP_DIR"

crontab -l 2>/dev/null | cat - <<EOF | crontab -

# VitaHub — Meta CAPI outbox (cada 5 minutos)
*/5 * * * * curl -s -X POST "$CRON_URL/meta-capi" -H "x-cron-secret: $SECRET" -H "Content-Type: application/json" -d '{"limit":50}' -m 60 >> $APP_DIR/logs/cron-meta-capi.log 2>&1

# VitaHub — Meta CAPI diagnostics (cada hora a minuto 0)
0 * * * * curl -s "$CRON_URL/meta-capi/diagnostics" -H "x-cron-secret: $SECRET" -m 30 >> $APP_DIR/logs/cron-meta-capi-diag.log 2>&1

# VitaHub — Limpieza de leads expirados (diario a las 04:00)
# Nota: requiere implementar endpoint o job independiente
# 0 4 * * * cd $APP_DIR && $NODE apps/api/dist/core/jobs/cron/purge-expired-leads.job.js >> $APP_DIR/logs/cron-purge-leads.log 2>&1

EOF

echo "Crontab actualizado."
echo "Verifica con: crontab -l"
echo "Los logs se escriben en: $APP_DIR/logs/"

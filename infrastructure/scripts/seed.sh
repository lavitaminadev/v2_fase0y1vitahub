#!/bin/bash
# VITAHUB Database Seed Script
# Usage: ./infrastructure/scripts/seed.sh

set -e

DB_NAME=${DB_DATABASE:-${DB_NAME:-vitahub}}
DB_USER=${DB_USERNAME:-${DB_USER:-vitahub}}
: "${DB_PASSWORD:?DB_PASSWORD must be set before running the seed}"
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
SEED_FILE=${SEED_FILE:-./database/seeds/seed.sql}

echo "🌱 Seeding $DB_NAME from $SEED_FILE ..."

if [ ! -f "$SEED_FILE" ]; then
  echo "❌ Seed file not found: $SEED_FILE"
  exit 1
fi

CREDENTIALS_FILE=$(mktemp)
trap 'rm -f "$CREDENTIALS_FILE"' EXIT
chmod 600 "$CREDENTIALS_FILE"
printf '[client]\npassword=%s\n' "$DB_PASSWORD" > "$CREDENTIALS_FILE"

mysql \
  --defaults-extra-file="$CREDENTIALS_FILE" \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  "$DB_NAME" < "$SEED_FILE"

echo "✅ Seed complete"

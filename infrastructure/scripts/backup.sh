#!/bin/bash
# VITAHUB Database Backup Script
# Usage: ./infrastructure/scripts/backup.sh [output_dir]

set -e

BACKUP_DIR=${1:-./backups}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME=${DB_DATABASE:-${DB_NAME:-vitahub}}
DB_USER=${DB_USERNAME:-${DB_USER:-vitahub}}
: "${DB_PASSWORD:?DB_PASSWORD must be set before running a backup}"
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
RETENTION_DAYS=${RETENTION_DAYS:-30}

mkdir -p "$BACKUP_DIR"

CREDENTIALS_FILE=$(mktemp)
trap 'rm -f "$CREDENTIALS_FILE"' EXIT
chmod 600 "$CREDENTIALS_FILE"
printf '[client]\npassword=%s\n' "$DB_PASSWORD" > "$CREDENTIALS_FILE"

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "⏳ Backing up $DB_NAME to $BACKUP_FILE ..."

mysqldump \
  --defaults-extra-file="$CREDENTIALS_FILE" \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "✅ Backup complete: $(du -h "$BACKUP_FILE" | cut -f1)"

# Remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "🧹 Cleaned up backups older than $RETENTION_DAYS days"

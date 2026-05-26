#!/bin/bash
# Backup automático de la base de datos PostgreSQL
# Uso:
#   ./scripts/backup-db.sh                    # backup manual
#   ./scripts/backup-db.sh --restore backup.sql  # restaurar
#
# Para programar backups automáticos (cron diario a las 3am):
#   0 3 * * * /path/to/marketplace/scripts/backup-db.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Configuración (sobreescribir con variables de entorno o .env)
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"
DB_PASSWORD="${PGPASSWORD:-postgres}"
DB_NAME="${PGDATABASE:-marketplace_unisabana}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

# --- Restore ---
if [ "${1:-}" = "--restore" ]; then
    RESTORE_FILE="${2:-}"
    if [ -z "$RESTORE_FILE" ]; then
        echo "Uso: $0 --restore <archivo.sql>"
        exit 1
    fi
    if [ ! -f "$RESTORE_FILE" ]; then
        echo "Archivo no encontrado: $RESTORE_FILE"
        exit 1
    fi
    echo "Restaurando $RESTORE_FILE ..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$RESTORE_FILE"
    echo "Restauración completa."
    exit 0
fi

# --- Backup ---
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/marketplace_${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Iniciando backup de $DB_NAME ..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    --compress=9 \
    --file="$FILENAME"

# Verify backup
if [ -f "$FILENAME" ]; then
    SIZE=$(du -h "$FILENAME" | cut -f1)
    echo "Backup completado: $FILENAME ($SIZE)"
else
    echo "ERROR: Backup falló"
    exit 1
fi

# Limpiar backups antiguos
find "$BACKUP_DIR" -name "marketplace_${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "Backups anteriores a $RETENTION_DAYS días eliminados."

# Mantener solo los últimos 10 backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
    ls -1t "$BACKUP_DIR"/*.sql.gz | tail -n +11 | xargs rm -f
    echo "Backups excedentes eliminados (máx. 10)."
fi

echo "--- Backup finalizado ---"

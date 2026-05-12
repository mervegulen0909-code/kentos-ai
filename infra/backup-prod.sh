#!/bin/sh
set -eu

REPO_DIR="${KENTOS_REPO_DIR:-/opt/kentos-ai}"
BACKUP_ROOT="${KENTOS_BACKUP_ROOT:-/opt/kentos-backups}"
RETENTION_DAYS="${KENTOS_BACKUP_RETENTION_DAYS:-14}"
COMPOSE_FILE="${KENTOS_COMPOSE_FILE:-infra/docker-compose.prod.yml}"
ENV_FILE="${KENTOS_ENV_FILE:-.env.production.local}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_ROOT}/${STAMP}"

cd "$REPO_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "env file not found: ${REPO_DIR}/${ENV_FILE}" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_ROOT" "$BACKUP_DIR"

echo "writing postgres dump to ${BACKUP_DIR}/postgres.sql.gz"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U kentos kentos_ai | gzip -9 > "${BACKUP_DIR}/postgres.sql.gz"

MINIO_VOLUME="$(docker volume ls --format '{{.Name}}' | grep '_minio-prod-data$' | head -n 1 || true)"
if [ -n "$MINIO_VOLUME" ]; then
  echo "writing minio volume archive to ${BACKUP_DIR}/minio-prod-data.tar.gz"
  docker run --rm \
    -v "${MINIO_VOLUME}:/data:ro" \
    -v "${BACKUP_DIR}:/backup" \
    alpine:3.20 \
    tar -C /data -czf /backup/minio-prod-data.tar.gz .
else
  echo "warning: minio volume not found; skipping object-store archive" >&2
fi

sha256sum "${BACKUP_DIR}"/* > "${BACKUP_DIR}/SHA256SUMS"
chmod 600 "${BACKUP_DIR}"/*

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -print -exec rm -rf {} \;

echo "backup complete: ${BACKUP_DIR}"

#!/bin/sh
set -eu

REPO_DIR="${KENTOS_REPO_DIR:-/opt/kentos-ai}"
COMPOSE_FILE="${KENTOS_COMPOSE_FILE:-infra/docker-compose.prod.yml}"
ENV_FILE="${KENTOS_ENV_FILE:-.env.production.local}"

cd "$REPO_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "env file not found: ${REPO_DIR}/${ENV_FILE}" >&2
  exit 1
fi

set -a
. "./${ENV_FILE}"
set +a

API_HEALTH_URL="https://${API_DOMAIN}/api/v1/health"
GATEWAY_HEALTH_URL="https://${GATEWAY_DOMAIN}/health"

echo "compose status"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

UNHEALTHY="$(docker ps --filter health=unhealthy --format '{{.Names}}' | tr '\n' ' ')"
if [ -n "$UNHEALTHY" ]; then
  echo "unhealthy containers: ${UNHEALTHY}" >&2
  exit 1
fi

curl -fsS --max-time 20 "$API_HEALTH_URL" >/dev/null
curl -fsS --max-time 20 "$GATEWAY_HEALTH_URL" >/dev/null

echo "healthcheck complete: api and gateway healthy"

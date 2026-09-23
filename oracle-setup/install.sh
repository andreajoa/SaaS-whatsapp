#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.oracle.yml --env-file .env.oracle)

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale Docker Engine + Compose v2 na VM Oracle e rode novamente." >&2
  exit 1
fi

if [ ! -f .env.oracle ]; then
  cp .env.oracle.example .env.oracle
  echo "Criei .env.oracle a partir do exemplo. Preencha os valores e rode novamente." >&2
  exit 1
fi

required=(
  WAHA_DOMAIN REDIS_DOMAIN ACME_EMAIL NEXT_PUBLIC_APP_URL WAHA_WEBHOOK_BASE_URL
  WAHA_API_KEY WAHA_API_KEY_SHA512 WAHA_HMAC_SECRET INTERNAL_SECRET SRH_TOKEN
  SUPABASE_DB_URL NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
)

set -a
# shellcheck disable=SC1091
source .env.oracle
set +a

for key in "${required[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "Variável obrigatória vazia em .env.oracle: $key" >&2
    exit 1
  fi
done

if [ -n "${UPSTASH_REDIS_REST_TOKEN:-}" ] && [ "${UPSTASH_REDIS_REST_TOKEN}" != "${SRH_TOKEN}" ]; then
  echo "UPSTASH_REDIS_REST_TOKEN precisa ser igual a SRH_TOKEN." >&2
  exit 1
fi

arch="$(uname -m)"
case "$arch" in
  aarch64|arm64)
    : "${WAHA_IMAGE:=devlikeapro/waha:noweb-arm-2026.7.2}"
    ;;
  x86_64|amd64)
    if [[ "${WAHA_IMAGE:-}" == *"-arm"* ]]; then
      echo "VM AMD64 detectada, mas WAHA_IMAGE é ARM. Use devlikeapro/waha:noweb-2026.7.2." >&2
      exit 1
    fi
    ;;
  *)
    echo "Arquitetura não testada: $arch" >&2
    exit 1
    ;;
esac

echo "Baixando imagens..."
"${COMPOSE[@]}" pull

echo "Subindo runtime Oracle..."
"${COMPOSE[@]}" up -d --remove-orphans

echo
"${COMPOSE[@]}" ps
echo
echo "Runtime Oracle iniciado."
echo "WAHA:  https://${WAHA_DOMAIN}"
echo "Redis: https://${REDIS_DOMAIN}"

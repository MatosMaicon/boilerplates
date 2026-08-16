#!/usr/bin/env bash
#
# Sobe o Postgres local (Docker) e deixa o banco pronto para o backend subir:
# aguarda ficar healthy, aplica as migrations e roda o seed (idempotente).
#
# Uso:
#   ./scripts/db-up.sh            # sobe + migrate + seed
#   ./scripts/db-up.sh --no-seed  # sobe + migrate, sem seed
#
# Depois: npm run start:dev  (API em http://localhost:3000, docs em /docs)

set -euo pipefail

# Raiz do backend (pai da pasta scripts/), independente de onde o script é chamado.
API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$API_DIR"

CONTAINER="boilerplate-postgres"
SEED=1
[[ "${1:-}" == "--no-seed" ]] && SEED=0

echo "▶ Subindo o Postgres (docker compose up -d)…"
docker compose up -d

echo "▶ Aguardando o Postgres ficar healthy…"
for i in $(seq 1 30); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "starting")"
  if [[ "$status" == "healthy" ]]; then
    echo "  ✓ Postgres pronto."
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "  ✗ Timeout esperando o Postgres. Veja: docker compose logs postgres" >&2
    exit 1
  fi
  sleep 2
done

echo "▶ Aplicando as migrations (drizzle-kit migrate)…"
npm run db:migrate

if [[ "$SEED" == "1" ]]; then
  echo "▶ Rodando o seed (idempotente)…"
  npm run db:seed
fi

echo ""
echo "✅ Banco pronto. Agora suba o backend:"
echo "     npm run start:dev          # API + OpenAPI em http://localhost:3000/docs"
echo "     npm run start:worker:dev   # worker das filas (processo separado)"

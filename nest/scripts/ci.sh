#!/usr/bin/env bash
#
# Gate de qualidade do projeto.
#
# O projeto é de um desenvolvedor só (ver CLAUDE.md § Qualidade): não há CI em
# runner remoto, este script É o CI. Rode antes de abrir PR.
#
#   ./scripts/ci.sh            # tudo: typecheck + lint + formatação + unit + integração
#   ./scripts/ci.sh --fast     # pula a integração (não precisa de Docker)
#
# Sai com código != 0 no primeiro passo que falhar, imprimindo qual foi.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Cores só quando a saída é um terminal — em pipe/log fica texto limpo.
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'
else
  BOLD=''; RED=''; GREEN=''; YELLOW=''; DIM=''; OFF=''
fi

FAST=0
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    *) echo "${RED}Argumento desconhecido: $arg${OFF}" >&2; exit 2 ;;
  esac
done

STEP_NUM=0
FAILED_STEP=''

# Imprime o cabeçalho do passo e roda o comando no diretório dado.
# Uso: step "<rótulo>" "<dir>" <comando...>
step() {
  local label="$1" dir="$2"; shift 2
  STEP_NUM=$((STEP_NUM + 1))
  printf '\n%s▸ [%d] %s%s %s(%s)%s\n' "$BOLD" "$STEP_NUM" "$label" "$OFF" "$DIM" "${dir#"$ROOT"/}" "$OFF"

  local start elapsed
  start=$SECONDS
  if ! (cd "$dir" && "$@"); then
    FAILED_STEP="$label"
    return 1
  fi
  elapsed=$((SECONDS - start))
  printf '%s  ✓ %s%s %s(%ss)%s\n' "$GREEN" "$label" "$OFF" "$DIM" "$elapsed" "$OFF"
}

on_failure() {
  printf '\n%s✗ CI falhou em: %s%s\n' "$RED$BOLD" "$FAILED_STEP" "$OFF"
  printf '%sCorrija e rode de novo. Atalhos: npm run lint:fix · npm run format%s\n\n' "$DIM" "$OFF"
}
trap 'on_failure' ERR

API="$ROOT/apps/api"

if [[ ! -d "$API/node_modules" ]]; then
  printf '%sDependências ausentes em apps/api. Rode:%s\n' "$YELLOW" "$OFF" >&2
  printf '  cd apps/api && npm install --legacy-peer-deps\n' >&2
  exit 1
fi

TOTAL_START=$SECONDS
printf '%sCI local%s' "$BOLD" "$OFF"
[[ $FAST -eq 1 ]] && printf ' %s(--fast: sem integração)%s' "$DIM" "$OFF"
printf '\n'

step 'typecheck (tsc)'      "$API" npm run --silent typecheck
step 'lint (eslint)'        "$API" npm run --silent lint
step 'formatação (prettier)' "$API" npm run --silent format:check
step 'testes unitários'     "$API" npm run --silent test

if [[ $FAST -eq 1 ]]; then
  printf '\n%s⏭  integração pulada (--fast)%s\n' "$YELLOW" "$OFF"
elif ! docker info >/dev/null 2>&1; then
  # Testcontainers precisa de um daemon acessível. Falhar aqui com a causa é
  # melhor que deixar o Vitest estourar timeout de 120s sem explicar.
  FAILED_STEP='integração (Docker indisponível)'
  printf '\n%sDocker não está acessível — os testes de integração sobem um Postgres%s\n' "$RED" "$OFF" >&2
  printf '%seffêmero via Testcontainers. Suba o Docker ou rode com --fast.%s\n' "$RED" "$OFF" >&2
  exit 1
else
  step 'testes de integração' "$API" npm run --silent test:int
fi

trap - ERR
printf '\n%s✓ CI passou%s %s(%ss no total)%s\n\n' "$GREEN$BOLD" "$OFF" "$DIM" "$((SECONDS - TOTAL_START))" "$OFF"

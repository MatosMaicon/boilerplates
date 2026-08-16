#!/usr/bin/env bash
#
# Renomeia o boilerplate para um projeto novo. Rode UMA vez, logo após o clone.
#
#   ./scripts/init.sh minha-loja
#   ./scripts/init.sh minha-loja --dry-run    # mostra o que mudaria, sem escrever
#
# Substitui o token `boilerplate` pelo nome do projeto nos pontos onde ele é
# identificador (nome do pacote, contêiner, banco, volume, WORKDIR) — NÃO faz
# sed cego no repositório inteiro, para não estragar prosa da documentação.
#
# Depois de rodar, ainda cabe a você:
#   1. preencher a CAMADA 1 do CLAUDE.md (produto, stack, contextos)
#   2. decidir o que fazer com apps/api/src/modules/example (renomear ou apagar)
#   3. gerar o BETTER_AUTH_SECRET no .env
#   4. reiniciar o histórico do git, se quiser (o script se oferece para isso)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN='boilerplate'

if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'
else
  BOLD=''; RED=''; GREEN=''; YELLOW=''; DIM=''; OFF=''
fi

die() { printf '%s%s%s\n' "$RED" "$1" "$OFF" >&2; exit 1; }

NAME="${1:-}"
DRY_RUN=0
for arg in "${@:2}"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) die "Argumento desconhecido: $arg" ;;
  esac
done

[[ -n "$NAME" ]] || die "Uso: ./scripts/init.sh <nome-do-projeto> [--dry-run]"

# Nome precisa servir como nome de pacote npm, de banco Postgres e de contêiner.
# Minúsculas, dígitos e hífen; começando por letra.
if [[ ! "$NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
  die "Nome inválido: '$NAME'. Use minúsculas, dígitos e hífen, começando por letra (ex.: minha-loja)."
fi

[[ "$NAME" != "$TOKEN" ]] || die "Esse já é o nome do boilerplate. Escolha outro."

# Identificador para Postgres: hífen não é válido em nome de banco/usuário sem
# aspas, então vira underscore.
DB_NAME="${NAME//-/_}"

# Arquivos onde `boilerplate` é IDENTIFICADOR, não prosa.
FILES=(
  "apps/api/package.json"
  "apps/api/package-lock.json"
  "apps/api/docker-compose.yml"
  "apps/api/.env.example"
  "apps/api/scripts/db-up.sh"
  ".devcontainer/Dockerfile"
)

printf '%sRenomeando o boilerplate → %s%s\n' "$BOLD" "$NAME" "$OFF"
[[ $DRY_RUN -eq 1 ]] && printf '%s(dry-run: nada será escrito)%s\n' "$YELLOW" "$OFF"
printf '\n'

# Detecta boilerplate já inicializado: se o package.json não tem mais o token,
# rodar de novo não faria nada útil e provavelmente é engano.
if ! grep -q "$TOKEN" "$ROOT/apps/api/package.json" 2>/dev/null; then
  die "apps/api/package.json não contém '$TOKEN' — este repositório já parece inicializado."
fi

changed=0
for rel in "${FILES[@]}"; do
  path="$ROOT/$rel"
  [[ -f "$path" ]] || { printf '  %s· %s (ausente, pulando)%s\n' "$DIM" "$rel" "$OFF"; continue; }

  hits=$(grep -c "$TOKEN" "$path" 2>/dev/null || true)
  [[ "${hits:-0}" -gt 0 ]] || continue

  printf '  %s✓%s %-34s %s%s ocorrência(s)%s\n' "$GREEN" "$OFF" "$rel" "$DIM" "$hits" "$OFF"
  changed=$((changed + hits))

  if [[ $DRY_RUN -eq 0 ]]; then
    # Identificadores de Postgres (banco, usuário, volume) não aceitam hífen sem
    # aspas, então usam a variante com underscore. Todo o resto — nome de
    # pacote, contêiner, WORKDIR — usa o nome como veio.
    #
    # As regras de underscore vêm ANTES da genérica e são ancoradas ao contexto
    # exato: uma regra ampla como `s|/TOKEN$|/DB_NAME|` também pegaria o
    # `WORKDIR /workspaces/TOKEN`, que deve manter o hífen.
    sed -i \
      -e "s/${TOKEN}_pgdata/${DB_NAME}_pgdata/g" \
      -e "s/POSTGRES_USER: ${TOKEN}/POSTGRES_USER: ${DB_NAME}/g" \
      -e "s/POSTGRES_PASSWORD: ${TOKEN}/POSTGRES_PASSWORD: ${DB_NAME}/g" \
      -e "s/POSTGRES_DB: ${TOKEN}/POSTGRES_DB: ${DB_NAME}/g" \
      -e "s|postgres://${TOKEN}:${TOKEN}@\([^/]*\)/${TOKEN}|postgres://${DB_NAME}:${DB_NAME}@\1/${DB_NAME}|g" \
      -e "s/-U ${TOKEN} -d ${TOKEN}/-U ${DB_NAME} -d ${DB_NAME}/g" \
      -e "s/${TOKEN}/${NAME}/g" \
      "$path"
  fi
done

printf '\n'
if [[ $DRY_RUN -eq 1 ]]; then
  printf '%s%d substituição(ões) seriam feitas.%s Rode sem --dry-run para aplicar.\n\n' "$BOLD" "$changed" "$OFF"
  exit 0
fi

printf '%s✓ %d substituição(ões) aplicadas.%s\n\n' "$GREEN$BOLD" "$changed" "$OFF"

# O histórico do boilerplate raramente interessa ao projeto novo, mas apagá-lo
# sem perguntar seria destrutivo demais para um script de init.
if [[ -d "$ROOT/.git" ]]; then
  printf '%sO repositório ainda tem o histórico do boilerplate.%s\n' "$YELLOW" "$OFF"
  printf 'Para começar do zero:\n'
  printf '  %srm -rf .git && git init && git add -A && git commit -m "chore: estrutura inicial"%s\n\n' "$DIM" "$OFF"
fi

cat <<EOF
${BOLD}Próximos passos${OFF}

  1. Preencha a ${BOLD}CAMADA 1${OFF} do CLAUDE.md — produto, stack, bounded contexts.
     Enquanto os <PREENCHER> estiverem lá, todo agente que ler o repo vai trabalhar às cegas.

  2. Decida o que fazer com ${BOLD}apps/api/src/modules/example${OFF}:
     renomeie para o seu primeiro contexto, ou apague (o módulo diz o que remover junto).

  3. cd apps/api && cp .env.example .env
     Gere o segredo:  ${DIM}openssl rand -base64 32${OFF}

  4. npm install --legacy-peer-deps   ${DIM}# a flag não é opcional — ver ADR 0007${OFF}
     docker compose up -d && npm run db:migrate && npm run db:seed
     npm run start:dev

  5. ./scripts/ci.sh   ${DIM}# confirme que tudo passa antes da primeira feature${OFF}
EOF

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Cria (ou reusa) um usuário de teste e imprime o cookie de sessão do
# Better Auth, para bater nas rotas protegidas com curl. Substitui o antigo
# kc-token.sh — não há mais IdP externo nem troca de code (ver ADR 0008).
#
# Uso:
#   ./scripts/auth-session.sh                          # usuário de teste padrão
#   ./scripts/auth-session.sh outro@email.com senha    # outro usuário
#
#   COOKIE=$(./scripts/auth-session.sh)
#   curl -H "Cookie: $COOKIE" http://localhost:3000/me
#
# Overrides por env: API_URL
# ─────────────────────────────────────────────────────────────
set -euo pipefail

API="${API_URL:-http://localhost:3000}"
EMAIL="${1:-teste@example.com}"
PASSWORD="${2:-senha-de-teste-123}"
NAME="${3:-Usuário de Teste}"

json() {
  printf '{"name":"%s","email":"%s","password":"%s"}' "$NAME" "$EMAIL" "$PASSWORD"
}

# 1) Tenta cadastrar. Se o e-mail já existir, o Better Auth responde erro e
#    seguimos direto para o login — por isso o cadastro não é fatal aqui.
curl -s -o /dev/null -X POST "$API/auth/sign-up/email" \
  -H 'Content-Type: application/json' -d "$(json)" || true

# 2) Login: o cookie de sessão vem no Set-Cookie.
HEADERS="$(curl -s -D - -o /dev/null -X POST "$API/auth/sign-in/email" \
  -H 'Content-Type: application/json' \
  -d "$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD")")"

COOKIE="$(printf '%s' "$HEADERS" | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: *//' | cut -d';' -f1 | paste -sd'; ' -)"

if [ -z "$COOKIE" ]; then
  echo "erro: login não retornou cookie de sessão (credenciais inválidas ou API fora do ar?)" >&2
  exit 1
fi

printf '%s\n' "$COOKIE"

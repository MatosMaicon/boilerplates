#!/bin/bash
# Verificação do firewall — NÃO precisa de privilégio, roda como 'node'.
#
# Serve a dois propósitos:
#   1. Chamado no fim do init-firewall.sh, prova que as regras recém-aplicadas
#      funcionam.
#   2. Chamado no postStartCommand, prova que o ENTRYPOINT realmente rodou. Se
#      o firewall nunca tiver sido aplicado, o VS Code mostra a falha em vez de
#      deixar o container aberto silenciosamente.
#
# Sem privilégio de propósito: sob --security-opt=no-new-privileges o usuário
# 'node' não consegue escalar, então esta verificação tem de funcionar sem sudo.
set -uo pipefail

fail=0

if curl -s -m 5 -o /dev/null https://example.com 2>/dev/null; then
  echo "ERRO: example.com acessivel — o firewall NAO esta bloqueando a saida." >&2
  fail=1
fi

if ! curl -s -m 10 -o /dev/null https://api.anthropic.com 2>/dev/null; then
  echo "ERRO: api.anthropic.com inacessivel — a allowlist quebrou o Claude Code." >&2
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "Firewall OK: saida bloqueada, exceto a allowlist."
fi

exit "$fail"

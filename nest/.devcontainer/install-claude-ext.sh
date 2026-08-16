#!/usr/bin/env bash
# Instala a extensão do Claude Code no container a partir do .vsix assado na
# imagem (ver Dockerfile), se ainda não estiver instalada. Rodado pelo
# postAttachCommand. NÃO usa o Marketplace e NÃO depende de volume persistente
# (que dessincroniza o extensions.json e deixa a extensão "órfã").
set -uo pipefail

VSIX=/opt/extensions/claude-code.vsix
EXT_ID=anthropic.claude-code

# Localiza o CLI 'code' do VS Code Server.
CODE="$(command -v code 2>/dev/null || ls -1 "$HOME"/.vscode-server/bin/*/bin/remote-cli/code 2>/dev/null | head -1 || true)"
if [ -z "${CODE:-}" ]; then
  echo "[claude-ext] CLI 'code' não encontrado; pulando."
  exit 0
fi

# O 'code' remote-cli precisa do socket IPC da sessão ATIVA. Não dá para confiar
# no VSCODE_IPC_HOOK_CLI do ambiente: quando o postStartCommand falha, o VS Code
# aborta a sessão e a variável fica apontando para um socket morto — o install
# então estoura com ECONNREFUSED em vez de tentar outro. Por isso testamos cada
# candidato de fato e ficamos com o primeiro que responder (o do ambiente
# primeiro, depois os mais recentes em disco).
#
# E é preciso INSISTIR: num "Reload Window" o postAttachCommand dispara antes de
# o servidor abrir o socket novo, então uma sondagem única falha por timing, não
# por erro real. Sockets mortos recusam a conexão na hora, então o retry só
# custa tempo no caso em que o servidor está mesmo subindo.
SOCK=""
LIST=""
for _ in $(seq 1 10); do
  for candidate in "${VSCODE_IPC_HOOK_CLI:-}" \
                   $(ls -1t /tmp/user/*/vscode-ipc-*.sock /tmp/vscode-ipc-*.sock 2>/dev/null); do
    [ -S "$candidate" ] || continue
    if LIST="$(VSCODE_IPC_HOOK_CLI="$candidate" timeout 5 "$CODE" --list-extensions 2>/dev/null)"; then
      SOCK="$candidate"
      break 2
    fi
  done
  sleep 2
done

if [ -z "$SOCK" ]; then
  # Sem IPC não dá para saber o estado real: o extensions.json fica dessincronizado
  # (já observado com 0 entradas e a extensão instalada e funcionando), então a
  # presença do diretório serve só para escolher a mensagem, não para decidir.
  if ls -d "$HOME"/.vscode-server/extensions/"$EXT_ID"-* >/dev/null 2>&1; then
    echo "[claude-ext] IPC do VS Code indisponivel, mas a extensao ja esta no disco; nada a fazer."
  else
    echo "[claude-ext] nenhum socket IPC do VS Code respondeu; pulando." >&2
    echo "[claude-ext] Instale pela paleta: 'Extensions: Install from VSIX...' -> $VSIX" >&2
  fi
  exit 0
fi
export VSCODE_IPC_HOOK_CLI="$SOCK"

if echo "$LIST" | grep -qix "$EXT_ID"; then
  echo "[claude-ext] Já instalada."
  exit 0
fi

echo "[claude-ext] Instalando $EXT_ID de $VSIX (arquivo local, sem Marketplace)..."
if "$CODE" --install-extension "$VSIX" --force; then
  echo "[claude-ext] OK — recarregue a janela se ela não ativar sozinha."
else
  echo "[claude-ext] Falhou. Rode manualmente: code --install-extension $VSIX" >&2
fi

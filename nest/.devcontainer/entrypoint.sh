#!/bin/bash
# ENTRYPOINT do container: aplica o firewall como root e só então entrega o
# controle ao processo principal.
#
# Por que aqui e não no postStartCommand:
#   Com --security-opt=no-new-privileges o 'sudo' deixa de funcionar (é setuid),
#   então o antigo `sudo init-firewall.sh` no postStartCommand falharia e o
#   container subiria SEM firewall. O ENTRYPOINT roda como root antes de
#   qualquer outra coisa e é reexecutado a cada `docker start`, que é
#   exatamente a garantia de que precisamos (regras de iptables vivem no
#   network namespace e somem no stop/start).
#
# Requer "containerUser": "root" no devcontainer.json. O usuário interativo
# continua sendo 'node' via "remoteUser".
#
# NÃO usa `set -e`: se o firewall falhar, queremos o container VIVO e ISOLADO
# (o init-firewall.sh põe as políticas em DROP como primeiríssima ação), não um
# container morto que não dá para depurar. Quem denuncia a falha é o
# check-firewall.sh no postStartCommand.
set -uo pipefail

if [ "$(id -u)" -eq 0 ]; then
  if ! /usr/local/bin/init-firewall.sh; then
    echo "AVISO: init-firewall.sh falhou. O container segue com a politica DROP" >&2
    echo "       aplicada no inicio do script, ou seja, ISOLADO. Investigue com:" >&2
    echo "       docker exec -u root <container> /usr/local/bin/init-firewall.sh" >&2
  fi
else
  echo "AVISO: entrypoint nao esta rodando como root (uid $(id -u)); firewall NAO" >&2
  echo "       aplicado. Confira \"containerUser\": \"root\" no devcontainer.json." >&2
fi

# Rede de segurança: se o CMD vier vazio, `exec` sem argumentos não faria nada e
# o container morreria logo após aplicar o firewall.
if [ "$#" -eq 0 ]; then
  exec sleep infinity
fi

exec "$@"

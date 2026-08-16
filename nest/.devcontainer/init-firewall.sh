#!/bin/bash
# Firewall de saída com allowlist: bloqueia TODA a internet do container,
# exceto os domínios estritamente necessários para o Claude Code e o npm.
#
# Executado como root pelo ENTRYPOINT a CADA start do container (ver
# entrypoint.sh). Regras de iptables vivem no network namespace do container e
# são perdidas em docker stop/start, por isso não pode ser postCreateCommand.
#
# O usuário 'node' NÃO consegue executar este script: não há grant de sudo e o
# container roda com --security-opt=no-new-privileges. Isso é intencional —
# quem pode reaplicar o firewall também poderia derrubá-lo (`iptables -F`), e
# isso seria um escape trivial de toda a contenção.
#
# Para "refrescar" a allowlist quando os IPs das CDNs rotacionam, reinicie o
# container (o ENTRYPOINT roda de novo) ou, a partir do HOST:
#   docker exec -u root <container> /usr/local/bin/init-firewall.sh
#
# NÃO existe modo "open". Para abrir a rede, pare o container e ajuste a
# allowlist abaixo a partir do host.
set -euo pipefail
IFS=$'\n\t'

if [ "$#" -gt 0 ]; then
  echo "Uso: $0   (sem argumentos)" >&2
  exit 1
fi

# Domínios liberados. GitHub está deliberadamente FORA: operações de git
# (clone/fetch/pull/push) são feitas fora do container, por decisão do projeto.
# Os *.githubusercontent.com são CDNs somente-leitura de que o npm depende para
# baixar binários de release; não permitem escrita e não servem para push.
# claude.ai E platform.claude.com são AMBOS exigidos pelo login OAuth e pela
# renovação do token (ver docs "Choose a sandbox environment"). Hoje os dois
# resolvem para o mesmo IP, então o segundo já entrava de carona no ipset — está
# listado porque a allowlist é por IP, não por domínio: no dia em que a Anthropic
# separar os endereços, o refresh de token quebraria sem aviso.
# statsig.anthropic.com não tem registro DNS público (é bug conhecido do script
# de referência). Fica só por paridade; o tráfego está desligado de qualquer
# forma via CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1.
ALLOWED_DOMAINS=(
  "api.anthropic.com"
  "console.anthropic.com"
  "claude.ai"
  "platform.claude.com"
  "statsig.anthropic.com"
  "registry.npmjs.org"
  "raw.githubusercontent.com"
  "objects.githubusercontent.com"
)

# --- 1. Fecha ANTES de qualquer outra coisa (fail-closed) -------------------
# A política vai para DROP primeiro e só depois as regras são reconstruídas.
# Assim, se o script abortar no meio (set -e), o container fica ISOLADO em vez
# de aberto.
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
iptables -F
iptables -X 2>/dev/null || true

# A tabela nat NÃO é tocada de propósito: o Docker pode manter ali o redirect
# do resolver embutido (127.0.0.11). Flushá-la quebraria o DNS do container.

ipset destroy allowed-domains 2>/dev/null || true

# --- 2. IPv6 totalmente fechado ---------------------------------------------
# O ipset abaixo é IPv4-only. Sem isto, todo o tráfego IPv6 escaparia da
# allowlist.
if command -v ip6tables >/dev/null 2>&1 && ip6tables -L >/dev/null 2>&1; then
  ip6tables -P INPUT DROP
  ip6tables -P FORWARD DROP
  ip6tables -P OUTPUT DROP
  ip6tables -F
  ip6tables -X 2>/dev/null || true
  # Loopback IPv6 continua liberado (serviços locais em ::1)
  ip6tables -A INPUT  -i lo -j ACCEPT
  ip6tables -A OUTPUT -o lo -j ACCEPT
  echo "IPv6: bloqueado."
else
  echo "IPv6: ip6tables indisponivel, ignorando."
fi

# --- 3. Regras base ----------------------------------------------------------
iptables -A INPUT  -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
iptables -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# DNS apenas para os resolvers declarados no resolv.conf — não para qualquer
# servidor do mundo (DNS aberto é um canal de exfiltração por tunelamento).
DNS_SERVERS="$(awk '/^nameserver/ {print $2}' /etc/resolv.conf | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)"
if [ -z "$DNS_SERVERS" ]; then
  echo "ERRO: nenhum nameserver IPv4 em /etc/resolv.conf; abortando (rede fica fechada)." >&2
  exit 1
fi
for dns in $DNS_SERVERS; do
  echo "DNS liberado: $dns"
  iptables -A OUTPUT -p udp -d "$dns" --dport 53 -j ACCEPT
  iptables -A OUTPUT -p tcp -d "$dns" --dport 53 -j ACCEPT
done

# Postgres de desenvolvimento: roda como container IRMÃO no Docker do host
# (apps/api/docker-compose.yml), publicado em <host>:5433. Sem esta regra o
# OUTPUT DROP descarta os pacotes em silêncio e a API só vê timeout — não
# ECONNREFUSED, o que torna o sintoma difícil de ler.
#
# Buraco deliberadamente mínimo: um IP, uma porta, TCP. O destino é o gateway do
# Docker da própria máquina, não a internet, então não serve de canal de
# exfiltração como serviria uma faixa RFC1918 inteira.
HOST_IP="$(getent hosts host.docker.internal | awk '{print $1}' | head -1)"
if [ -n "$HOST_IP" ]; then
  echo "Postgres liberado: $HOST_IP:5433"
  iptables -A OUTPUT -p tcp -d "$HOST_IP" --dport 5433 -j ACCEPT
else
  echo "AVISO: host.docker.internal nao resolve; o Postgres ficara inacessivel." >&2
fi

# NÃO há regra liberando a porta 22 de saída. SSH para qualquer destino seria
# um túnel de exfiltração universal, contornando a allowlist inteira.

# --- 4. Resolve a allowlist e libera só esses IPs -----------------------------
ipset create allowed-domains hash:net

for domain in "${ALLOWED_DOMAINS[@]}"; do
  ips="$(dig +short A "$domain" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || true)"
  if [ -z "$ips" ]; then
    echo "AVISO: nao resolveu $domain" >&2
    continue
  fi
  echo "Liberando $domain -> $(echo "$ips" | tr '\n' ' ')"
  for ip in $ips; do
    ipset add allowed-domains "$ip" 2>/dev/null || true
  done
done

iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# --- 5. Verificação: o firewall precisa PROVAR que está funcionando ----------
# Sem isto, uma falha silenciosa deixaria o container aberto sem ninguém notar.
# A mesma verificação roda de novo no postStartCommand, sem privilégio, para
# provar que este script chegou a ser executado.
exec /usr/local/bin/check-firewall.sh

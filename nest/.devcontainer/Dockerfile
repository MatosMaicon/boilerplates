FROM node:24-bookworm

ARG TZ
ENV TZ="$TZ"

# Ferramentas de desenvolvimento + o que o firewall precisa (iptables, ipset, dig, jq)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates sudo less \
    iptables ipset dnsutils jq \
 && rm -rf /var/lib/apt/lists/*

# Persistência do histórico do bash (montado como volume no devcontainer.json)
RUN mkdir -p /commandhistory && chown -R node:node /commandhistory

# Diretório de config do Claude, montado como volume (ver devcontainer.json),
# criado com dono 'node' para o volume herdar a permissão certa na 1ª montagem.
# Sem isto o volume nasce root:root e o 'node' não salva o login ("Failed to
# retrieve auth status after login").
RUN mkdir -p /home/node/.claude \
 && chown -R node:node /home/node/.claude

# Instala o Claude Code (CLI)
RUN npm install -g @anthropic-ai/claude-code

# Extensão do VS Code (Claude Code) "assada" na imagem: baixamos o .vsix no build
# (rede aberta) e instalamos a partir do arquivo local no attach (ver
# install-claude-ext.sh + postAttachCommand). Assim não dependemos do Marketplace
# em runtime nem de volume persistente (que dessincroniza o extensions.json e
# deixa a extensão "órfã").
# IMPORTANTE: o .vsix é específico por plataforma. O container é x86_64, então tem
# de ser linux-x64 — a build ARM64 quebra com "qemu-aarch64: ld-linux-aarch64.so.1".
# Para atualizar a extensão, troque a versão fixada (ao usar targetPlatform o
# Marketplace exige versão explícita; "latest" retorna 404).
ARG CLAUDE_EXT_VERSION=2.1.232
RUN mkdir -p /opt/extensions \
 && curl -fSL --compressed -o /opt/extensions/claude-code.vsix \
    "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/anthropic/vsextensions/claude-code/${CLAUDE_EXT_VERSION}/vspackage?targetPlatform=linux-x64"

COPY install-claude-ext.sh /usr/local/bin/install-claude-ext.sh
RUN chmod +x /usr/local/bin/install-claude-ext.sh

# Scripts de firewall. Todos root:root e sem permissão de escrita para 'node',
# que NÃO recebe grant de sudo: o firewall é aplicado pelo ENTRYPOINT (root) e
# o container roda com --security-opt=no-new-privileges, então não há caminho de
# escalada de 'node' para root — e portanto nenhum caminho para `iptables -F`.
COPY init-firewall.sh check-firewall.sh entrypoint.sh /usr/local/bin/
RUN chmod 0755 /usr/local/bin/init-firewall.sh \
                /usr/local/bin/check-firewall.sh \
                /usr/local/bin/entrypoint.sh

# Aplica o firewall antes de entregar o controle ao processo principal, a cada
# `docker start`. Depende de DUAS chaves no devcontainer.json:
#   "containerUser": "root"    -> o ENTRYPOINT precisa de root para o iptables
#   "overrideCommand": false   -> sem isto a extensão Dev Containers sobe o
#                                 container com --entrypoint /bin/sh e ESTE
#                                 ENTRYPOINT é descartado em silêncio.
# O CMD é o que mantém o container vivo (papel que o script de override da
# extensão cumpria antes).
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["sleep", "infinity"]

USER node
WORKDIR /workspaces/boilerplate

# Specs

Especificações de features. **Leia a spec antes de implementar** — e escreva a spec antes de
codar.

## Como usar

- Copie `_template.md` para `NN-nome-da-feature.md`
- Numere pela **ordem de execução**: cada spec assume que as anteriores existem
- Uma spec descreve o que a feature faz e por quê; **decisões arquiteturais vão para
  [`../adr/`](../adr/)**, não aqui

## Índice

| Ordem | Spec | Status |
|---|---|---|
| — | _(nenhuma spec ainda)_ | |

## Por que specs, se existem os ADRs

São coisas diferentes e é comum confundir:

- **Spec** responde *o que vamos construir* — comportamento, regras, telas, critérios de aceitação.
  Vive enquanto a feature vive e é atualizada quando ela muda.
- **ADR** responde *por que decidimos assim* — a alternativa descartada, o custo aceito. É
  imutável: mudou de ideia, escreva um ADR novo que supera o antigo.

Se você está escrevendo "escolhemos X em vez de Y porque…", isso é um ADR, não uma spec.

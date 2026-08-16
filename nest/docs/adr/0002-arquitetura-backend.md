# ADR 0002: Arquitetura do Backend — Monólito Modular Pragmático

**Status:** Aceito
**Data:** 2026-08-16

## Contexto

Todo backend novo enfrenta a mesma escolha antes da primeira linha: quanta abstração adotar. As
duas falhas são simétricas — cair em over-engineering (hexagonal completo para um CRUD) ou em
acoplamento por módulos finos demais (um módulo por tela, que se injetam mutuamente).

O boilerplate precisa de uma resposta default: a que serve à maioria dos projetos e é barata de
abandonar quando não servir.

## Decisão

Adotar um **monólito modular pragmático**, NestJS idiomático:

- **Um módulo por bounded context**, não por tela. Telas são muitas e mudam; contextos são poucos e
  estáveis. Comece com poucos módulos — é mais fácil dividir um módulo grande do que juntar cinco
  pequenos que nasceram errados.
- Fluxo `controller (fino) → service (regra) → Drizzle (acesso a dados direto no service)`.
- Classe `*.repository.ts` **só** onde a regra é rica o bastante para justificar — não é camada
  obrigatória.
- **Sem** arquitetura hexagonal e **sem** CQRS/event bus interno.
- Coordenação entre contextos: chamada direta de service dentro de uma **transação Drizzle**
  (`db.transaction`). Efeitos não-transacionais (e-mail, indexação, chamadas a terceiros) rodam
  pós-commit, fora da transação.

Duas regras de direção de dependência sustentam o resto (detalhadas em `apps/api/CLAUDE.md`):

1. **Services retornam entidades de domínio, nunca DTOs.** A projeção acontece no boundary.
2. **Services recebem tipos de domínio planos, nunca DTOs.** O DTO de query implementa a interface
   de domínio.

Sem essas duas, o formato de resposta HTTP vaza para dentro do negócio e o service deixa de ser
reutilizável por outra projeção ou pelo worker.

## Consequências

**Positivo:**
- Pouco boilerplate por feature — entrega rápida.
- Fronteiras de contexto claras sem a cerimônia de ports/adapters.
- A estrutura espelha a linguagem do domínio, então é fácil de navegar (por humano e por agente).

**Negativo:**
- Services tocam o ORM direto — testar service sem banco exige um fake do query builder (que existe
  no módulo `example`, e cuja limitação é conhecida: não valida o SQL). Quem cobre o SQL é o teste
  de integração com Postgres real.
- Coordenação multi-agregado numa transação acopla contextos entre si.
- Sem event bus, side effects encadeados ficam explícitos no service orquestrador — menos
  desacoplado, porém mais fácil de seguir lendo.

## Alternativas consideradas

- **Clean/Hexagonal (ports & adapters):** domínio isolado do Nest e do ORM, mais testável, mas
  muito mais boilerplate por feature. Desproporcional para a maioria dos projetos que partem daqui.
- **DDD + CQRS (`@nestjs/cqrs`):** commands/queries/events com bus interno. Bom para fluxos de
  orquestração densos, pesado para tudo o mais.
- **Um módulo por tela:** mapeamento 1:1 fácil no início, mas gera injeção cruzada entre módulos
  finos — um checkout acabaria puxando cinco módulos.

## Ponto de reavaliação

Se a coordenação de um fluxo multi-agregado ficar densa demais dentro de uma transação, reavaliar a
introdução de um event bus interno (`@nestjs/cqrs` ou padrão outbox). Escreva um ADR novo.

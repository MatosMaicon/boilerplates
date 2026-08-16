/**
 * Problem Details (RFC 9457) — formato canônico de erro da API.
 * Ver ADR 0003. Content-Type: application/problem+json.
 */
export interface ProblemDetail {
  /** URI que identifica o tipo do problema. `about:blank` quando só o status importa. */
  type: string;
  /** Resumo legível e curto do tipo do problema. */
  title: string;
  /** Código HTTP, repetido no corpo por conveniência. */
  status: number;
  /** Explicação específica desta ocorrência. */
  detail?: string;
  /** URI da requisição que gerou o problema. */
  instance?: string;
  /** Membros de extensão (ex.: erros de validação campo a campo). */
  [key: string]: unknown;
}

export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PROBLEM_JSON_CONTENT_TYPE, type ProblemDetail } from './problem-detail';

/**
 * Piso dos erros de servidor, tipado como `number` de propósito: `resolveStatus`
 * devolve `number` (vem de `HttpException.getStatus()`), e comparar `number` com
 * o enum `HttpStatus` direto dispara `no-unsafe-enum-comparison`.
 */
const SERVER_ERROR_FLOOR: number = HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * Filter global que normaliza QUALQUER exceção em application/problem+json
 * (RFC 9457). Ver ADR 0003. Registrado em main.ts como filter global.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.resolveStatus(exception);
    const problem: ProblemDetail = {
      type: 'about:blank',
      title: this.resolveTitle(exception, status),
      status,
      instance: request.url,
    };

    const detail = this.resolveDetail(exception);
    if (detail) problem.detail = detail;

    const errors = this.resolveValidationErrors(exception);
    if (errors) problem.errors = errors;

    if (status >= SERVER_ERROR_FLOOR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveTitle(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body) {
        return String((body as Record<string, unknown>).error);
      }
      return exception.name.replace(/Exception$/, '');
    }
    return status >= SERVER_ERROR_FLOOR ? 'Internal Server Error' : 'Error';
  }

  private resolveDetail(exception: unknown): string | undefined {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') return body;
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const message = (body as Record<string, unknown>).message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return 'A requisição falhou na validação.';
      }
      return exception.message;
    }
    // Nunca vaza stack/mensagem interna de erro não-tratado ao cliente.
    return undefined;
  }

  /** Erros do ValidationPipe (array de mensagens) viram membro de extensão `errors`. */
  private resolveValidationErrors(exception: unknown): string[] | undefined {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const message = (body as Record<string, unknown>).message;
        if (Array.isArray(message)) return message as string[];
      }
    }
    return undefined;
  }
}

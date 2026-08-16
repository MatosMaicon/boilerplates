import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AUTH, type Auth } from './auth.provider';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY, type AuthenticatedUser, type UserRole } from './roles';

/**
 * Guard global (registrado via APP_GUARD).
 *
 * **Autentica** resolvendo a sessão do Better Auth a partir do cookie que o BFF
 * do Next.js encaminha, e **autoriza** pelo `role`. Como o auth server roda
 * dentro desta API (ADR 0006), o `getSession` é uma consulta ao mesmo Postgres —
 * não há chamada de rede a IdP externo, e revogar sessão tem efeito imediato.
 *
 * Rotas `@Public()` passam sem sessão; `@Roles(...)` restringe por papel.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) {
      throw new UnauthorizedException('Sessão ausente ou expirada.');
    }

    // O Better Auth não conhece nosso soft delete: uma sessão emitida
    // antes da exclusão continuaria válida sem esta checagem.
    if (session.user.deletedAt) {
      throw new UnauthorizedException('Conta removida.');
    }

    const user: AuthenticatedUser = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role as UserRole,
      emailVerified: session.user.emailVerified,
    };
    request.user = user;

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length && !required.includes(user.role)) {
      throw new ForbiddenException('Seu papel não permite esta ação.');
    }

    return true;
  }
}

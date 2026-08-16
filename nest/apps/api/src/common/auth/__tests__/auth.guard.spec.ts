import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AuthGuard } from '../auth.guard';
import type { Auth } from '../auth.provider';
import { IS_PUBLIC_KEY, Public } from '../public.decorator';
import { ROLES_KEY, Roles, type AuthenticatedUser, type UserRole } from '../roles';

type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  deletedAt: Date | null;
};

const member: SessionUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'maria@example.com',
  role: 'user',
  emailVerified: true,
  deletedAt: null,
};

/** Fake do auth server: só a superfície que o guard consome (`api.getSession`). */
function makeAuth(user: SessionUser | null): Auth {
  return {
    api: { getSession: async () => (user ? { user } : null) },
  } as unknown as Auth;
}

/** Metadados de rota: o que `@Public()` / `@Roles()` teriam gravado. */
function makeReflector(metadata: { isPublic?: boolean; roles?: UserRole[] } = {}): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY) return metadata.isPublic;
      if (key === ROLES_KEY) return metadata.roles;
      return undefined;
    },
  } as unknown as Reflector;
}

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  it('libera rota @Public() sem exigir sessão', async () => {
    const guard = new AuthGuard(makeReflector({ isPublic: true }), makeAuth(null));

    await expect(guard.canActivate(makeContext({ headers: {} }))).resolves.toBe(true);
  });

  it('rejeita com 401 quando não há sessão', async () => {
    const guard = new AuthGuard(makeReflector(), makeAuth(null));

    await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejeita com 401 usuário soft-deletado, mesmo com sessão válida', async () => {
    const guard = new AuthGuard(
      makeReflector(),
      makeAuth({ ...member, deletedAt: new Date('2026-08-01T00:00:00Z') }),
    );

    await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('autentica e popula request.user quando não há @Roles', async () => {
    const guard = new AuthGuard(makeReflector(), makeAuth(member));
    const request: { headers: Record<string, string>; user?: AuthenticatedUser } = { headers: {} };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: member.id,
      email: member.email,
      role: 'user',
      emailVerified: true,
    });
  });

  it('rejeita com 403 quando o papel não está entre os exigidos', async () => {
    const guard = new AuthGuard(makeReflector({ roles: ['admin'] }), makeAuth(member));

    await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('aceita quando o papel está entre os exigidos', async () => {
    const guard = new AuthGuard(
      makeReflector({ roles: ['user', 'admin'] }),
      makeAuth({ ...member, role: 'admin' }),
    );

    await expect(guard.canActivate(makeContext({ headers: {} }))).resolves.toBe(true);
  });
});

describe('decorators de auth', () => {
  it('@Public() marca a rota como pública', () => {
    class Controller {
      @Public()
      handler() {}
    }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Controller.prototype.handler)).toBe(true);
  });

  it('@Roles() grava os papéis exigidos', () => {
    class Controller {
      @Roles('user', 'admin')
      handler() {}
    }
    expect(Reflect.getMetadata(ROLES_KEY, Controller.prototype.handler)).toEqual(['user', 'admin']);
  });
});

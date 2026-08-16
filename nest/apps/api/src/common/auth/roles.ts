import { SetMetadata } from '@nestjs/common';

/**
 * Papéis do usuário. **NÃO são acumuláveis:** `users.role` é um enum único, não
 * uma lista. A escolha é deliberada — papel acumulável tende a virar um sistema
 * de permissões ad-hoc espalhado por guards.
 *
 * Se o seu domínio precisar de papéis que se somam (ex.: alguém que é ao mesmo
 * tempo comprador e vendedor), a saída não é transformar isto num array: ou o
 * papel "maior" engloba as capacidades do menor, ou o caso pede uma tabela de
 * permissões de verdade.
 *
 * Ajuste esta união junto com o enum `userRole` em `modules/identity/user.schema.ts`
 * — os dois precisam concordar.
 */
export type UserRole = 'user' | 'admin';

export interface AuthenticatedUser {
  /** `users.id` — o mesmo id da sessão do Better Auth. */
  id: string;
  email: string;
  /** Papel canônico lido do banco (não há claim espelhado de IdP externo). */
  role: UserRole;
  emailVerified: boolean;
}

export const ROLES_KEY = 'roles';

/** Restringe a rota aos papéis informados. Sem `@Roles`, basta estar autenticado. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

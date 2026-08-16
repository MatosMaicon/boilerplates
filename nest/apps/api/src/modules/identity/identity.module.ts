import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

/**
 * Bounded context `identity` (ADR 0002): usuários e papéis.
 *
 * Note a divisão: o **auth server** (Better Auth) é transversal e vive em
 * `common/auth/` — instância, guard e decorators. Este módulo cuida do
 * **domínio** de identidade, e hoje entrega só `GET /me`.
 */
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class IdentityModule {}

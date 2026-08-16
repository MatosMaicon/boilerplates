import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '@/common/database/database.module';
import { notDeleted } from '@/common/database/soft-delete';
import { users, type User } from './user.schema';

/**
 * Leitura do perfil de domínio. As credenciais e as sessões são geridas pelo
 * Better Auth (ver `common/auth/auth.provider.ts`); aqui fica o que é do
 * domínio — papel e verificações.
 */
@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Perfil por id. Lança 404 se não existir ou estiver soft-deletado. */
  async findById(id: string): Promise<User> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), notDeleted(users.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return row;
  }
}

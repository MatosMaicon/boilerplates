import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Database } from '@/common/database/database.module';
import { MeDto } from '../dto/me.dto';
import type { User } from '../user.schema';
import { UserService } from '../user.service';

const fakeUser: User = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Maria da Silva',
  email: 'maria@example.com',
  emailVerified: true,
  image: null,
  role: 'user',
  termsAcceptedAt: new Date('2026-08-01T00:00:00Z'),
  termsVersion: '2026-06',
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
  deletedAt: null,
};

/** Fake do Drizzle: o query builder é encadeável e resolve no `await`. */
function makeDb(rows: User[]): Database {
  const thenable = (result: unknown): unknown =>
    new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === 'then'
            ? (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled)
            : () => thenable(result),
      },
    );

  return { select: () => thenable(rows) } as unknown as Database;
}

describe('UserService', () => {
  it('findById() retorna a entidade crua (o mapeamento fica no controller)', async () => {
    const user = await new UserService(makeDb([fakeUser])).findById(fakeUser.id);

    expect(user.email).toBe('maria@example.com');
    // Colunas internas seguem intactas na entidade — quem decide o que expor é o DTO.
    expect(user).toHaveProperty('deletedAt', null);
  });

  it('findById() lança 404 quando não há linha viva', async () => {
    await expect(new UserService(makeDb([])).findById(fakeUser.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('MeDto', () => {
  it('expõe o perfil de domínio sem vazar credencial nem coluna interna', () => {
    const dto = MeDto.fromEntity(fakeUser);

    expect(dto).toEqual({
      id: fakeUser.id,
      name: 'Maria da Silva',
      email: 'maria@example.com',
      emailVerified: true,
      role: 'user',
      image: null,
    });
    expect(dto).not.toHaveProperty('deletedAt');
    expect(dto).not.toHaveProperty('termsAcceptedAt');
  });
});

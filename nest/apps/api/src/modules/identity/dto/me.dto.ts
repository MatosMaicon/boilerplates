import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { userRole, type User, type UserRoleValue } from '../user.schema';

/**
 * Perfil do usuário logado (`GET /me`). É a fonte que o frontend usa para
 * decidir navegação e permissões.
 *
 * Não expõe nada de credencial: senha e tokens vivem em `accounts`, geridos
 * pelo Better Auth, e nunca saem por aqui.
 */
export class MeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Maria da Silva' })
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ description: 'Verificação de e-mail (canônica no banco).' })
  emailVerified!: boolean;

  @ApiProperty({ enum: userRole.enumValues })
  role!: UserRoleValue;

  @ApiPropertyOptional({ format: 'uri' })
  image?: string | null;

  static fromEntity(this: void, user: User): MeDto {
    const dto = new MeDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.emailVerified = user.emailVerified;
    dto.role = user.role;
    dto.image = user.image;
    return dto;
  }
}

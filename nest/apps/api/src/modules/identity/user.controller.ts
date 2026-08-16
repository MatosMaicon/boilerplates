import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '@/common/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/common/auth/roles';
import { MeDto } from './dto/me.dto';
import { UserService } from './user.service';

@ApiTags('identity')
@Controller()
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário logado.' })
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({ description: 'Sessão ausente ou expirada.' })
  async me(@CurrentUser() current: AuthenticatedUser): Promise<MeDto> {
    return MeDto.fromEntity(await this.users.findById(current.id));
  }
}

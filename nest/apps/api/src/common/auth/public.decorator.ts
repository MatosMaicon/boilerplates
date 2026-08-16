import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Libera a rota do guard OIDC global (ex.: vitrine, detalhe público, /health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

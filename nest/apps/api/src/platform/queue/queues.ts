/**
 * Nomes canônicos das filas BullMQ (ADR 0002 / 0005).
 *
 * Topologia: a API (main.ts) só ENFILEIRA; o worker (worker.ts) CONSUME.
 * A fila `video` (FFmpeg, CPU-intensiva) é candidata a serviço worker dedicado.
 *
 * ⚠️ STUB (commit 1): a conexão BullMQ (Upstash Redis) ainda não é registrada —
 * entra quando a primeira fila real (indexação/vídeo/email) for implementada,
 * junto com `UPSTASH_REDIS_URL` obrigatório no env.schema.
 */
export const QUEUES = {
  video: 'video',
  email: 'email',
  indexing: 'indexing',
  notifications: 'notifications',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

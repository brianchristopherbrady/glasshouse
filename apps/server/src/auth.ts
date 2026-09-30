import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Builds the bearer-token guard for /api/* routes (health check excluded).
 * Extracted as a pure function so it's unit-testable without spinning up
 * the whole server process/listening on a real port.
 */
export function createAuthHook(token: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith('/api') || req.url === '/api/health') return;
    if (req.headers.authorization !== `Bearer ${token}`) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  };
}

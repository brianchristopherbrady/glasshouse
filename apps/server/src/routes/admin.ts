import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ROLES, generateToken, hashToken } from '../auth.js';
import { reportError } from '../monitoring.js';

const CreateTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.enum(ROLES),
  repositoryId: z.string().min(1).nullable().optional(),
});

const ClientErrorSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(10_000).optional(),
  componentStack: z.string().max(10_000).optional(),
  url: z.string().max(2000).optional(),
});

const TOKEN_FIELDS = {
  id: true,
  name: true,
  role: true,
  repositoryId: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

export async function adminRoutes(
  app: FastifyInstance,
  { prisma, authEnabled }: { prisma: PrismaClient; authEnabled: boolean },
): Promise<void> {
  app.get('/api/auth/me', async (req) => {
    const p = req.principal!;
    return { authEnabled, name: p.name, role: p.role, kind: p.kind, repositoryId: p.repositoryId };
  });

  app.get('/api/tokens', async () => {
    return prisma.apiToken.findMany({ select: TOKEN_FIELDS, orderBy: { createdAt: 'desc' } });
  });

  // The plaintext token is returned exactly once; only its hash is stored.
  app.post('/api/tokens', async (req, reply) => {
    const parsed = CreateTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const { name, role, repositoryId } = parsed.data;
    if (repositoryId) {
      const repo = await prisma.repository.findUnique({
        where: { id: repositoryId },
        select: { id: true },
      });
      if (!repo) return reply.code(404).send({ error: 'repository_not_found' });
    }
    const token = generateToken();
    const record = await prisma.apiToken.create({
      data: { name, role, repositoryId: repositoryId ?? null, tokenHash: hashToken(token) },
      select: TOKEN_FIELDS,
    });
    req.log.info({ tokenId: record.id, role, by: req.principal?.name }, 'api token created');
    return reply.code(201).send({ ...record, token });
  });

  app.delete<{ Params: { id: string } }>('/api/tokens/:id', async (req, reply) => {
    const existing = await prisma.apiToken.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: 'token_not_found' });
    const record = await prisma.apiToken.update({
      where: { id: req.params.id },
      data: { revokedAt: new Date() },
      select: TOKEN_FIELDS,
    });
    req.log.info({ tokenId: record.id, by: req.principal?.name }, 'api token revoked');
    return record;
  });

  app.post(
    '/api/client-errors',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = ClientErrorSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
      const error = new Error(parsed.data.message);
      if (parsed.data.stack) error.stack = parsed.data.stack;
      req.log.warn({ clientError: parsed.data }, 'web client error');
      reportError(error, {
        source: 'web',
        url: parsed.data.url,
        componentStack: parsed.data.componentStack,
      });
      return reply.code(202).send({ ok: true });
    },
  );
}

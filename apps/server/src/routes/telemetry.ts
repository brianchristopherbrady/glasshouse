import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AgentEventSchema } from '@brianbrady/glasshouse-domain';
import { IngestError, ingestEvent, type IngestScope } from '../correlation.js';

const MAX_BATCH_SIZE = 1000;
const BatchSchema = z.object({ events: z.array(AgentEventSchema).min(1).max(MAX_BATCH_SIZE) });

function scopeOf(req: { principal?: { repositoryId: string | null } }): IngestScope {
  return { repositoryId: req.principal?.repositoryId ?? null };
}

export async function telemetryRoutes(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient },
): Promise<void> {
  app.post('/api/telemetry/events', async (req, reply) => {
    const parsed = AgentEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_event', issues: parsed.error.issues });
    }
    try {
      const result = await ingestEvent(prisma, parsed.data, scopeOf(req));
      return reply.code(result.status === 'ingested' ? 201 : 200).send({ ok: true, ...result });
    } catch (err) {
      if (err instanceof IngestError) {
        return reply.code(err.status).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // Each event is its own transaction and ingestion is idempotent by event
  // id, so a client can safely retry an entire batch after a partial failure.
  app.post('/api/telemetry/batch', async (req, reply) => {
    const parsed = BatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_batch', issues: parsed.error.issues });
    }
    let ingested = 0;
    let duplicates = 0;
    const errors: Array<{ index: number; error: string; message: string }> = [];
    for (const [index, event] of parsed.data.events.entries()) {
      try {
        const result = await ingestEvent(prisma, event, scopeOf(req));
        if (result.status === 'ingested') ingested += 1;
        else duplicates += 1;
      } catch (err) {
        if (!(err instanceof IngestError)) throw err;
        errors.push({ index, error: err.code, message: err.message });
      }
    }
    if (errors.length > 0) {
      const status = errors.some((e) => e.error === 'forbidden') ? 403 : 422;
      return reply.code(status).send({ ok: false, ingested, duplicates, errors });
    }
    return reply.code(201).send({ ok: true, ingested, duplicates });
  });
}

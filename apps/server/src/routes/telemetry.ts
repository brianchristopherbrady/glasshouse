import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AgentEventSchema } from '@agentic-flows/domain';
import { prisma } from '../db.js';

const BatchSchema = z.object({ events: z.array(AgentEventSchema) });

async function persistEvent(event: z.infer<typeof AgentEventSchema>): Promise<void> {
  await prisma.event.create({
    data: {
      id: event.id,
      runId: event.runId,
      spanId: event.spanId ?? null,
      parentSpanId: event.parentSpanId ?? null,
      timestamp: new Date(event.timestamp),
      kind: event.kind,
      actorType: event.actor?.type ?? null,
      actorId: event.actor?.id ?? null,
      actorName: event.actor?.name ?? null,
      data: JSON.stringify(event.data),
      evidenceSource: event.evidence.source,
      evidenceConfidence: event.evidence.confidence,
      evidenceNote: event.evidence.note ?? null,
    },
  });
}

export async function telemetryRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/telemetry/events', async (req, reply) => {
    const parsed = AgentEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_event', issues: parsed.error.issues });
    }
    await persistEvent(parsed.data);
    return reply.code(201).send({ ok: true });
  });

  app.post('/api/telemetry/batch', async (req, reply) => {
    const parsed = BatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_batch', issues: parsed.error.issues });
    }
    for (const event of parsed.data.events) {
      await persistEvent(event);
    }
    return reply.code(201).send({ ok: true, count: parsed.data.events.length });
  });
}

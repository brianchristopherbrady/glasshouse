import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { GithubWorkflowRun } from '../github.js';
import { GithubApiError } from '../github.js';
import type { GithubTokenResolver } from '../githubAuth.js';
import { upsertGithubRun } from '../githubRuns.js';
import { importChangedFiles } from './github.js';

export function verifyGithubSignature(
  secret: string,
  rawBody: Buffer,
  header: string | undefined,
): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`,
  );
  const presented = Buffer.from(header);
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}

interface WorkflowRunPayload {
  action?: string;
  workflow_run?: GithubWorkflowRun;
  repository?: { full_name?: string };
}

export async function webhookRoutes(
  app: FastifyInstance,
  {
    prisma,
    resolveGithubToken,
    secret,
  }: { prisma: PrismaClient; resolveGithubToken: GithubTokenResolver; secret: string | undefined },
): Promise<void> {
  // Signature verification needs the exact bytes GitHub signed, so this
  // encapsulated plugin swaps the JSON parser for a raw-buffer one.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) =>
    done(null, body),
  );

  app.post(
    '/api/webhooks/github',
    { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } },
    async (req, reply) => {
      // Refuse rather than accept unverifiable payloads.
      if (!secret) return reply.code(503).send({ error: 'webhook_not_configured' });
      const rawBody = req.body as Buffer;
      const signature = req.headers['x-hub-signature-256'];
      if (
        !verifyGithubSignature(
          secret,
          rawBody,
          typeof signature === 'string' ? signature : undefined,
        )
      ) {
        return reply.code(401).send({ error: 'invalid_signature' });
      }

      const event = req.headers['x-github-event'];
      if (event === 'ping') return { ok: true, event: 'ping' };
      if (event !== 'workflow_run')
        return reply.code(202).send({ ok: true, ignored: `event:${String(event)}` });

      let payload: WorkflowRunPayload;
      try {
        payload = JSON.parse(rawBody.toString('utf8')) as WorkflowRunPayload;
      } catch {
        return reply.code(400).send({ error: 'invalid_json' });
      }
      const run = payload.workflow_run;
      const fullName = payload.repository?.full_name;
      if (!run || !fullName) return reply.code(400).send({ error: 'invalid_payload' });

      const repository = await prisma.repository.findUnique({ where: { fullName } });
      if (!repository)
        return reply.code(202).send({ ok: true, ignored: 'unregistered_repository' });

      const { record } = await upsertGithubRun(prisma, repository, run);
      let changedFiles = 0;
      if (run.status === 'completed') {
        try {
          const token = await resolveGithubToken(repository.owner, repository.name);
          changedFiles = await importChangedFiles(prisma, repository, record, token);
        } catch (err) {
          // The run itself is recorded; changed files can be backfilled by a manual sync.
          if (!(err instanceof GithubApiError)) throw err;
          req.log.warn({ err: err.message }, 'could not import changed files from webhook');
        }
      }
      return { ok: true, runId: record.id, action: payload.action ?? null, changedFiles };
    },
  );
}

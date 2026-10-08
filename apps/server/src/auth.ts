import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const ROLES = ['admin', 'viewer', 'ingest'] as const;
export type Role = (typeof ROLES)[number];

export interface Principal {
  /** "bootstrap" = AGENTIC_FLOWS_API_TOKEN; "anonymous" = auth disabled. */
  kind: 'bootstrap' | 'token' | 'anonymous';
  tokenId: string | null;
  name: string;
  role: Role;
  /** Repository scope for ingest tokens; null = unscoped. */
  repositoryId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export interface StoredToken {
  id: string;
  name: string;
  role: string;
  repositoryId: string | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

export interface AuthOptions {
  /** Bootstrap admin token. When unset, auth is disabled (local/demo mode). */
  bootstrapToken?: string;
  findTokenByHash: (hash: string) => Promise<StoredToken | null>;
  markUsed?: (id: string) => Promise<void>;
}

const TOKEN_PREFIX = 'af_';
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

/** 256 bits of randomness — high enough entropy that a fast hash is appropriate. */
export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Which roles may call a route. Centralized (rather than per-route) so the
 * whole access policy can be read and tested in one place.
 */
export function requiredRoles(method: string, url: string): readonly Role[] | 'public' {
  const path = url.split('?')[0]!;
  if (!path.startsWith('/api/')) return 'public'; // static web app
  if (path === '/api/health' || path === '/api/ready') return 'public';
  // Authenticated by HMAC signature in the route itself, not a bearer token.
  if (method === 'POST' && path === '/api/webhooks/github') return 'public';
  if (method === 'POST' && path.startsWith('/api/telemetry/')) return ['admin', 'ingest'];
  if (path === '/api/auth/me' || (method === 'POST' && path === '/api/client-errors')) return ROLES;
  if (method === 'GET' || method === 'HEAD') return ['admin', 'viewer'];
  return ['admin'];
}

export function createAuthHook(options: AuthOptions) {
  const anonymous: Principal = {
    kind: 'anonymous',
    tokenId: null,
    name: 'anonymous',
    role: 'admin',
    repositoryId: null,
  };

  return async (req: FastifyRequest, reply: FastifyReply) => {
    const policy = requiredRoles(req.method, req.url);
    if (!options.bootstrapToken) {
      req.principal = anonymous;
      return;
    }
    if (policy === 'public') return;

    const header = req.headers.authorization;
    const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!presented) return reply.code(401).send({ error: 'unauthorized' });

    let principal: Principal | null = null;
    if (safeEqual(presented, options.bootstrapToken)) {
      principal = {
        kind: 'bootstrap',
        tokenId: null,
        name: 'bootstrap admin',
        role: 'admin',
        repositoryId: null,
      };
    } else if (presented.startsWith(TOKEN_PREFIX)) {
      const stored = await options.findTokenByHash(hashToken(presented));
      if (stored && !stored.revokedAt && (ROLES as readonly string[]).includes(stored.role)) {
        principal = {
          kind: 'token',
          tokenId: stored.id,
          name: stored.name,
          role: stored.role as Role,
          repositoryId: stored.repositoryId,
        };
        const stale =
          !stored.lastUsedAt ||
          Date.now() - stored.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS;
        if (stale && options.markUsed) await options.markUsed(stored.id);
      }
    }
    if (!principal) return reply.code(401).send({ error: 'unauthorized' });
    if (!policy.includes(principal.role)) {
      return reply
        .code(403)
        .send({ error: 'forbidden', message: `role "${principal.role}" cannot access this route` });
    }
    req.principal = principal;
  };
}

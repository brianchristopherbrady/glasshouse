import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';

/**
 * CSP hashes for the web app's inline <script> blocks (the pre-paint theme
 * script in index.html), computed from the actual built file so the policy
 * can stay strict ('self' + exact hashes) without 'unsafe-inline'.
 */
export function inlineScriptHashes(indexHtmlPath: string): string[] {
  let html: string;
  try {
    html = readFileSync(indexHtmlPath, 'utf8');
  } catch {
    return [];
  }
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    // Browsers hash the script after HTML input-stream preprocessing, which
    // normalizes CRLF/CR to LF — a CRLF checkout must hash the same bytes.
    const body = (match[1] ?? '').replace(/\r\n?/g, '\n');
    if (body.trim()) hashes.push(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
  return hashes;
}

export function buildContentSecurityPolicy(scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    // React Flow positions nodes with inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function registerSecurityHeaders(app: FastifyInstance, csp: string): void {
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Content-Security-Policy', csp);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });
}

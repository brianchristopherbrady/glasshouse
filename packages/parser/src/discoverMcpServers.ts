import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { DiscoveredMcpServer } from './types.js';

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

/**
 * Discovers MCP server configuration from `.vscode/mcp.json` (the current
 * GitHub/VS Code convention). One malformed config aborts nothing else in
 * discovery — it is simply skipped.
 */
export function discoverMcpServers(rootDir: string): DiscoveredMcpServer[] {
  const configPath = join(rootDir, '.vscode/mcp.json');
  if (!existsSync(configPath)) return [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return [];
  }

  const servers = parsed.servers;
  if (!servers || typeof servers !== 'object') return [];

  const relPath = toPosix(relative(rootDir, configPath));
  return Object.entries(servers as Record<string, unknown>).map(([name, config]) => {
    const cfg = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>;
    return {
      path: relPath,
      name,
      command: typeof cfg.command === 'string' ? cfg.command : undefined,
      args: Array.isArray(cfg.args) ? cfg.args.map(String) : undefined,
      rawConfig: cfg,
    };
  });
}

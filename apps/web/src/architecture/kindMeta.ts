import {
  GitBranch,
  FileCode2,
  Users,
  Sparkles,
  BookText,
  FileText as PromptIcon,
  Webhook,
  Plug,
  type LucideIcon,
} from 'lucide-react';
import type { DefinitionKind } from '../api/types.js';

export const KIND_META: Record<
  DefinitionKind,
  { label: string; icon: LucideIcon; colorClass: string }
> = {
  workflow: { label: 'Workflow', icon: GitBranch, colorClass: 'text-sky-400 border-sky-500/40' },
  'compiled-workflow': {
    label: 'Compiled workflow',
    icon: FileCode2,
    colorClass: 'text-sky-300 border-sky-500/30',
  },
  agent: { label: 'Agent', icon: Users, colorClass: 'text-emerald-400 border-emerald-500/40' },
  skill: { label: 'Skill', icon: Sparkles, colorClass: 'text-purple-400 border-purple-500/40' },
  instruction: {
    label: 'Instruction',
    icon: BookText,
    colorClass: 'text-amber-400 border-amber-500/40',
  },
  prompt: { label: 'Prompt', icon: PromptIcon, colorClass: 'text-fuchsia-400 border-fuchsia-500/40' },
  hook: { label: 'Hook', icon: Webhook, colorClass: 'text-orange-400 border-orange-500/40' },
  'mcp-server': { label: 'MCP server', icon: Plug, colorClass: 'text-cyan-400 border-cyan-500/40' },
};

export const KIND_ORDER: DefinitionKind[] = [
  'workflow',
  'compiled-workflow',
  'agent',
  'skill',
  'instruction',
  'prompt',
  'hook',
  'mcp-server',
];

export const RELATIONSHIP_LABELS: Record<string, string> = {
  USES: 'uses',
  CONFIGURES: 'configures',
  CAN_CALL: 'can call',
  LOADS: 'loads',
  REFERENCES: 'references',
  DEPENDS_ON: 'depends on',
  COMPILES_TO: 'compiles to',
  TRIGGERS: 'triggers',
  PERMITS: 'permits',
};

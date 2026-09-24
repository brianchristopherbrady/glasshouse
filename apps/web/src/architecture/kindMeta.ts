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
  { label: string; icon: LucideIcon; colorClass: string; badgeClass: string }
> = {
  workflow: {
    label: 'Workflow',
    icon: GitBranch,
    colorClass: 'text-kind-workflow border-kind-workflow/40',
    badgeClass: 'text-kind-workflow bg-kind-workflow-wash',
  },
  'compiled-workflow': {
    label: 'Compiled workflow',
    icon: FileCode2,
    colorClass: 'text-kind-compiled-workflow border-kind-compiled-workflow/40',
    badgeClass: 'text-kind-compiled-workflow bg-kind-compiled-workflow-wash',
  },
  agent: {
    label: 'Agent',
    icon: Users,
    colorClass: 'text-kind-agent border-kind-agent/40',
    badgeClass: 'text-kind-agent bg-kind-agent-wash',
  },
  skill: {
    label: 'Skill',
    icon: Sparkles,
    colorClass: 'text-kind-skill border-kind-skill/40',
    badgeClass: 'text-kind-skill bg-kind-skill-wash',
  },
  instruction: {
    label: 'Instruction',
    icon: BookText,
    colorClass: 'text-kind-instruction border-kind-instruction/40',
    badgeClass: 'text-kind-instruction bg-kind-instruction-wash',
  },
  prompt: {
    label: 'Prompt',
    icon: PromptIcon,
    colorClass: 'text-kind-prompt border-kind-prompt/40',
    badgeClass: 'text-kind-prompt bg-kind-prompt-wash',
  },
  hook: {
    label: 'Hook',
    icon: Webhook,
    colorClass: 'text-kind-hook border-kind-hook/40',
    badgeClass: 'text-kind-hook bg-kind-hook-wash',
  },
  'mcp-server': {
    label: 'MCP server',
    icon: Plug,
    colorClass: 'text-kind-mcp-server border-kind-mcp-server/40',
    badgeClass: 'text-kind-mcp-server bg-kind-mcp-server-wash',
  },
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

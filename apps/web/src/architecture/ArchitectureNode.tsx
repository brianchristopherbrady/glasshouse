import { Handle, Position } from '@xyflow/react';
import clsx from 'clsx';
import { KIND_META } from './kindMeta.js';
import type { ArchitectureNode as ArchNodeData } from '../api/types.js';

export function ArchitectureNodeView({ data }: { data: ArchNodeData }): JSX.Element {
  const meta = KIND_META[data.kind];
  const Icon = meta.icon;
  return (
    <div
      className={clsx(
        'w-56 rounded-lg border bg-surface-raised px-3 py-2 shadow-sm',
        meta.colorClass,
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80">
        <Icon size={11} />
        {meta.label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-text" title={data.name}>
        {data.name}
      </div>
      <div className="mono truncate text-[10px] text-text-muted" title={data.path}>
        {data.path}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-border" />
    </div>
  );
}

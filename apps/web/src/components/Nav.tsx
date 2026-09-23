import { NavLink, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  GitBranch,
  PlayCircle,
  Users,
  Sparkles,
  FileText,
  Network,
} from 'lucide-react';

const ITEMS = [
  { to: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: 'flows', label: 'Flows', icon: GitBranch, end: false },
  { to: 'runs', label: 'Runs', icon: PlayCircle, end: false },
  { to: 'agents', label: 'Agents', icon: Users, end: false },
  { to: 'skills', label: 'Skills', icon: Sparkles, end: false },
  { to: 'files', label: 'Files', icon: FileText, end: false },
  { to: 'architecture', label: 'Architecture', icon: Network, end: false },
] as const;

export function Nav(): JSX.Element {
  const { repoId } = useParams();
  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={repoId ? `/repos/${repoId}/${to}` : '/'}
          end={end}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-surface-raised text-text'
                : 'text-text-muted hover:bg-surface-raised hover:text-text',
            )
          }
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radar } from 'lucide-react';
import { Nav } from './components/Nav.js';
import { RepositorySelector } from './components/RepositorySelector.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { api } from './api/client.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { FlowsPage } from './pages/FlowsPage.js';
import { RunsPage } from './pages/RunsPage.js';
import { RunDetailPage } from './pages/RunDetailPage.js';
import { AgentsPage } from './pages/AgentsPage.js';
import { SkillsPage } from './pages/SkillsPage.js';
import { FilesPage } from './pages/FilesPage.js';
import { ArchitecturePage } from './pages/ArchitecturePage.js';

function RepoRedirect(): JSX.Element {
  const { data: repositories, isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: api.listRepositories,
  });
  if (isLoading) return <div className="p-6 text-text-muted">Loading repositories…</div>;
  const first = repositories?.[0];
  if (!first) {
    return (
      <div className="p-6 text-text-muted">
        No repositories found. Run the server seed script to load demo data.
      </div>
    );
  }
  return <Navigate to={`/repos/${first.id}`} replace />;
}

function Header(): JSX.Element {
  return (
    <header className="sticky top-0 z-20 h-14 shrink-0 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 text-[13px] font-semibold tracking-wide text-text no-underline"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-contrast">
              <Radar size={15} strokeWidth={2.25} />
            </span>
            <span className="hidden sm:inline">AGENTIC FLOWS</span>
          </Link>
          <Nav />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <RepositorySelector />
        </div>
      </div>
    </header>
  );
}

function RepoLayout(): JSX.Element {
  const { repoId } = useParams();
  if (!repoId) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Header />
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 py-6 sm:px-6">
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="flows" element={<FlowsPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="architecture" element={<ArchitecturePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<RepoRedirect />} />
      <Route path="/repos/:repoId/*" element={<RepoLayout />} />
    </Routes>
  );
}

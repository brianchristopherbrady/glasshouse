import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Nav } from './components/Nav.js';
import { RepositorySelector } from './components/RepositorySelector.js';
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
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold tracking-wide text-text">AGENTIC FLOWS</span>
        <Nav />
      </div>
      <RepositorySelector />
    </header>
  );
}

function RepoLayout(): JSX.Element {
  const { repoId } = useParams();
  if (!repoId) return <Navigate to="/" replace />;
  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="mx-auto max-w-[1400px] px-6 py-6">
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

import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Radar } from 'lucide-react';
import { Nav } from './components/Nav.js';
import { RepositorySelector } from './components/RepositorySelector.js';
import { ThemeToggle } from './components/ThemeToggle.js';
import { DemoBanner } from './components/DemoBanner.js';
import { DemoLanding } from './components/DemoLanding.js';
import { AuthGate } from './components/AuthGate.js';
import { STATIC_DEMO, api, setStoredToken } from './api/client.js';
import { useMe } from './hooks/useMe.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { FlowsPage } from './pages/FlowsPage.js';
import { RunsPage } from './pages/RunsPage.js';
import { RunDetailPage } from './pages/RunDetailPage.js';
import { AgentsPage } from './pages/AgentsPage.js';
import { SkillsPage } from './pages/SkillsPage.js';
import { FilesPage } from './pages/FilesPage.js';
import { ArchitecturePage } from './pages/ArchitecturePage.js';
import { SettingsPage } from './pages/SettingsPage.js';

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
        No repositories yet.{' '}
        <Link to="/settings" className="text-accent underline-offset-2 hover:underline">
          Connect a GitHub repository
        </Link>{' '}
        to get started.
      </div>
    );
  }
  return <Navigate to={`/repos/${first.id}`} replace />;
}

// Shows the demo splash screen once per page load in the static-demo build
// only — a direct link into a specific repo/page still bypasses it entirely,
// so bookmarked/shared demo URLs keep working.
function RootRoute(): JSX.Element {
  const [entered, setEntered] = useState(!STATIC_DEMO);
  if (!entered) return <DemoLanding onEnter={() => setEntered(true)} />;
  return <RepoRedirect />;
}

function SignOut(): JSX.Element | null {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  if (!me?.authEnabled) return null;
  return (
    <button
      type="button"
      onClick={() => {
        setStoredToken(null);
        void queryClient.resetQueries();
      }}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-raised hover:text-text"
      aria-label={`Sign out ${me.name}`}
      title={`Signed in as ${me.name} (${me.role}) — sign out`}
    >
      <LogOut size={15} strokeWidth={2.25} />
    </button>
  );
}

function Header(): JSX.Element {
  return (
    <header className="sticky top-0 z-20 h-14 shrink-0 border-b border-border bg-surface/95 backdrop-blur-sm supports-backdrop-filter:bg-surface/80">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 text-[13px] font-semibold tracking-wide text-text no-underline"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-contrast">
              <Radar size={15} strokeWidth={2.25} />
            </span>
            <span className="hidden sm:inline">GLASSHOUSE</span>
            {STATIC_DEMO && (
              <span className="rounded-full bg-status-running-wash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-running">
                Demo
              </span>
            )}
          </Link>
          <Nav />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <RepositorySelector />
          <SignOut />
        </div>
      </div>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Header />
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

function RepoLayout(): JSX.Element {
  const { repoId } = useParams();
  if (!repoId) return <Navigate to="/" replace />;
  return (
    <Shell>
      <Routes>
        <Route index element={<OverviewPage />} />
        <Route path="flows" element={<FlowsPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:runId" element={<RunDetailPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="architecture" element={<ArchitecturePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </Shell>
  );
}

export default function App(): JSX.Element {
  useEffect(() => {
    if (STATIC_DEMO) document.title = 'Glasshouse — Live Demo';
  }, []);
  const routes = (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route
        path="/settings"
        element={
          <Shell>
            <SettingsPage />
          </Shell>
        }
      />
      <Route path="/repos/:repoId/*" element={<RepoLayout />} />
    </Routes>
  );
  return (
    <>
      <DemoBanner />
      {STATIC_DEMO ? routes : <AuthGate>{routes}</AuthGate>}
    </>
  );
}

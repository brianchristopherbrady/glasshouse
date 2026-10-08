import { Component, type ErrorInfo, type ReactNode } from 'react';
import { api } from '../api/client.js';

const MAX_REPORTS_PER_PAGE = 5;
let reportsSent = 0;

/** Best-effort, rate-limited: a reporting failure must never cause another error. */
export function reportClientError(error: unknown, componentStack?: string): void {
  if (reportsSent >= MAX_REPORTS_PER_PAGE) return;
  reportsSent += 1;
  const err = error instanceof Error ? error : new Error(String(error));
  api
    .reportClientError({
      message: err.message.slice(0, 2000),
      stack: err.stack?.slice(0, 10_000),
      componentStack: componentStack?.slice(0, 10_000),
      url: window.location.href.slice(0, 2000),
    })
    .catch(() => undefined);
}

export function installGlobalErrorReporting(): void {
  window.addEventListener('error', (e) => reportClientError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportClientError(e.reason));
}

interface State {
  error: Error | null;
}

/** Keeps a render crash from blanking the whole app, and reports it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(error, info.componentStack ?? undefined);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg p-6 text-center"
      >
        <h1 className="text-lg font-semibold text-text">Something went wrong</h1>
        <p className="max-w-md text-sm text-text-muted">
          This page hit an unexpected error. It has been reported. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent-strong"
        >
          Reload
        </button>
      </div>
    );
  }
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import './styles/theme.css';

// Restores the real deep-linked path GitHub Pages' 404.html redirect
// encoded as ?redirect=... (Pages has no SPA fallback, so a hard navigation
// or refresh on a nested route would otherwise 404). No-op on any other host.
(function restoreGithubPagesRedirect() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (!redirect) return;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  window.history.replaceState(null, '', base + redirect);
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

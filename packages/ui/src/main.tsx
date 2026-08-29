import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.js";
import "./styles/theme.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root element missing from index.html");

// Server state (Blueprint/Scenario/Run lookups) goes through TanStack
// Query; live-streaming Run state goes through the Zustand store in
// src/runner/runStore.ts -- deliberately two different tools for two
// different kinds of state, not one library doing both jobs.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);

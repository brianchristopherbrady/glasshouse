// Centralized, small config so ports aren't duplicated across the codebase.
export const COLLECTOR_PORT = Number(process.env.AGENTARIUM_COLLECTOR_PORT ?? 4317);
export const CLIENT_PORT = Number(process.env.AGENTARIUM_CLIENT_PORT ?? 5173);
export const COLLECTOR_URL = `http://localhost:${COLLECTOR_PORT}`;
export const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;

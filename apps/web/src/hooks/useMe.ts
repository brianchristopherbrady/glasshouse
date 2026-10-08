import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';

/** The current caller's identity and role (anonymous admin when auth is disabled). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.getMe, retry: false, staleTime: 60_000 });
}

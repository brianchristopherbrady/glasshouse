import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';

export function RepositorySelector(): JSX.Element {
  const { repoId } = useParams();
  const navigate = useNavigate();
  const { data: repositories } = useQuery({
    queryKey: ['repositories'],
    queryFn: api.listRepositories,
  });

  return (
    <select
      className="max-w-[10rem] truncate rounded-md border border-border bg-surface-raised px-2 py-1.5 text-[13px] text-text sm:max-w-none"
      value={repoId ?? ''}
      onChange={(e) => navigate(`/repos/${e.target.value}`)}
      aria-label="Select repository"
    >
      {!repositories?.length && <option value="">Loading repositories…</option>}
      {repositories?.map((repo) => (
        <option key={repo.id} value={repo.id}>
          {repo.fullName}
        </option>
      ))}
    </select>
  );
}

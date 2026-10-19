import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

/**
 * Reads a one-time token from `?token=` once, then removes it from the address bar
 * (a history replace), so it does not linger in the URL, the history or a referrer.
 */
export function useOneTimeToken(): string | null {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => searchParams.get('token'));

  useEffect(() => {
    if (!searchParams.has('token')) return;
    const rest = new URLSearchParams(searchParams);
    rest.delete('token');
    const search = rest.toString();
    void navigate({ search: search ? `?${search}` : '' }, { replace: true });
  }, [navigate, searchParams]);

  return token && token.trim() ? token : null;
}

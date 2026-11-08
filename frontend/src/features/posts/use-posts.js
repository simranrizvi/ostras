'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

export function usePosts({ page, status, search }) {
  const [data, setData] = useState({ posts: [], pagination: { total: 0, pages: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ page: String(page), limit: '12', search });
      if (status !== 'all') params.set('status', status);
      try {
        setData(await api(`/posts?${params}`, { signal: controller.signal }));
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, status, search, revision]);
  return { ...data, loading, error, reload };
}

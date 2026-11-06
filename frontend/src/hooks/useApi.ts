'use client';
import { useCallback, useState } from 'react';
import api from '@/lib/api';
import { ApiError } from '@/types';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Generic hook for one-off API calls with loading/error state.
 *
 * @example
 * const { data, loading, error, execute } = useApi<Turf[]>();
 * useEffect(() => { execute(() => api.get('/turfs')); }, []);
 */
export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (call: () => Promise<{ data: T }>) => {
    setState({ data: null, loading: true, error: null });
    try {
      const { data } = await call();
      setState({ data, loading: false, error: null });
      return data;
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: ApiError } }).response?.data;
      const message = apiErr?.message ?? 'An unexpected error occurred';
      setState({ data: null, loading: false, error: message });
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}

/**
 * Convenience hook for fetching data on mount (read-only).
 *
 * @example
 * const { data: turfs, loading } = useFetch<Turf[]>('/turfs');
 */
export function useFetch<T>(url: string, params?: Record<string, unknown>) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await api.get<T>(url, { params });
      setState({ data, loading: false, error: null });
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: ApiError } }).response?.data;
      setState({ data: null, loading: false, error: apiErr?.message ?? 'Failed to load data' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(params)]);

  // Auto-fetch on mount
  useState(() => { refresh(); });

  return { ...state, refresh };
}


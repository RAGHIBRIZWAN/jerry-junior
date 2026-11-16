import { useCallback, useEffect, useState } from 'react';
import api, { isOfflineError } from './api';

/** GET helper: { data, loading, error, offline, retry } */
export default function useApi(path, params) {
  const [state, setState] = useState({ data: null, loading: true, error: null, offline: false });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null, offline: false }));
    api
      .get(path, { params: JSON.parse(key), signal: controller.signal })
      .then((res) => setState({ data: res.data, loading: false, error: null, offline: false }))
      .catch((err) => {
        if (axiosCancelled(err)) return;
        setState({ data: null, loading: false, error: err, offline: isOfflineError(err) });
      });
    return () => controller.abort();
  }, [path, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

const axiosCancelled = (err) => err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError';

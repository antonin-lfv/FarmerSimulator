"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { onMutation } from "./events";

// Subscribes `refresh` to the global mutation bus — call this alongside
// usePolledData when a value (wallet balance, storage, notifications...)
// needs to update the instant *any* mutation happens anywhere in the app,
// not just wait for its own poll interval.
export function useMutationRefresh(refresh: () => void) {
  useEffect(() => onMutation(refresh), [refresh]);
}

export function usePolledData<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const refresh = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (intervalMs <= 0) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}

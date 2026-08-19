"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import { onMutation } from "./events";

// A click (or, optionally, Escape) outside `ref`'s element closes a menu/
// popover — was hand-rolled near-identically in FarmMap, NavBurgerMenu,
// NavNotificationBell and InfoTip. `onOutside` is read through a ref so
// passing a fresh inline arrow function each render doesn't re-subscribe the
// listeners (same trick as usePolledData's fetcherRef below).
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  options?: { escape?: boolean; enabled?: boolean },
) {
  const { escape = false, enabled = true } = options ?? {};
  const onOutsideRef = useRef(onOutside);
  useEffect(() => {
    onOutsideRef.current = onOutside;
  });

  useEffect(() => {
    if (!enabled) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutsideRef.current();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOutsideRef.current();
    }
    document.addEventListener("mousedown", onClick);
    if (escape) document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      if (escape) document.removeEventListener("keydown", onKey);
    };
  }, [ref, escape, enabled]);
}

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

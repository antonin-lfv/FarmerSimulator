"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { usePolledData, useMutationRefresh } from "@/lib/hooks";
import { api } from "@/lib/api";
import type { Wallet } from "@/lib/types";

interface WalletContextValue {
  wallet: Wallet | null;
  /** Balance just before the current one — lets a consumer (AnimatedNumber)
   * tween from the old value instead of jumping straight to the new one. */
  previousBalance: number | null;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// One shared poll + mutation-bus subscription for the whole app instead of
// the navbar and FarmManager each polling /api/wallet independently on their
// own 5s timer (same interval, same data, two requests) — same pattern as
// CalendarProvider.
export function WalletProvider({ children }: { children: ReactNode }) {
  const { data: wallet, refresh } = usePolledData(() => api.getWallet(), 5000);
  useMutationRefresh(refresh);

  const previousBalanceRef = useRef<number | null>(null);
  const lastSeenRef = useRef<number | null>(null);
  if (wallet && wallet.balance_usd !== lastSeenRef.current) {
    previousBalanceRef.current = lastSeenRef.current;
    lastSeenRef.current = wallet.balance_usd;
  }

  return (
    <WalletContext.Provider value={{ wallet, previousBalance: previousBalanceRef.current, refresh }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}

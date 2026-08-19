"use client";

import { useEffect, useRef } from "react";
import { usePolledData, useMutationRefresh } from "@/lib/hooks";
import { api } from "@/lib/api";
import type { OngoingAction } from "@/lib/types";
import { ToastProvider, useToast } from "@/components/ui/ToastProvider";
import { CalendarProvider } from "@/lib/calendar-context";
import { WalletProvider } from "@/lib/wallet-context";
import { MarketTicker } from "@/components/market/MarketTicker";
import { Navbar } from "@/components/layout/Navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CalendarProvider>
        <WalletProvider>
          <AppShellInner>{children}</AppShellInner>
        </WalletProvider>
      </CalendarProvider>
    </ToastProvider>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  useActionCompletionToasts();

  return (
    <div className="flex min-h-screen w-full flex-col pt-20">
      <Navbar />
      <MarketTicker />
      <main className="min-w-0 flex-1 bg-background px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

function useActionCompletionToasts() {
  const push = useToast();
  const previousRef = useRef<Map<number, OngoingAction> | null>(null);
  const { data: ongoingActions, refresh } = usePolledData(() => api.getOngoingActions(), 2500);
  useMutationRefresh(refresh);

  useEffect(() => {
    if (!ongoingActions) return;
    const current = new Map(ongoingActions.map((a) => [a.ongoing_action_id, a]));
    const previous = previousRef.current;
    if (previous) {
      for (const [id, action] of previous) {
        if (!current.has(id)) {
          push({
            tone: "success",
            title: "Action terminée",
            description: `Parcelle ${action.parcel_id} — ${action.action_type}`,
          });
        }
      }
    }
    previousRef.current = current;
  }, [ongoingActions, push]);
}

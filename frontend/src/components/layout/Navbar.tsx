"use client";

import Link from "next/link";
import { useState } from "react";
import { Wallet, Warehouse } from "lucide-react";
import { usePolledData, useMutationRefresh } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useWallet } from "@/lib/wallet-context";
import { NavTimeWeather } from "@/components/layout/NavTimeWeather";
import { NavNotificationBell } from "@/components/layout/NavNotificationBell";
import { NavBurgerMenu } from "@/components/layout/NavBurgerMenu";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export function Navbar() {
  const { wallet, previousBalance } = useWallet();
  const { data: storage, refresh: refreshStorage } = usePolledData(
    () => api.getStorage(),
    10000,
  );
  useMutationRefresh(refreshStorage);

  const [storageHistory, setStorageHistory] = useState<{
    current: number | null;
    previous: number | null;
  }>({ current: null, previous: null });
  if (storage && storage.used !== storageHistory.current) {
    setStorageHistory({
      current: storage.used,
      previous: storageHistory.current,
    });
  }

  return (
    <header className="game-topbar">
      <Link href="/dashboard" className="game-wordmark">
        verdance<span>PRENEZ LE TEMPS DE CULTIVER.</span>
      </Link>

      <div className="min-w-0 flex-1" />

      <div className="flex min-w-0 items-center gap-2.5 overflow-x-auto py-1">
        <NavTimeWeather />

        <div
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-brand-50 px-3.5 text-sm font-semibold text-brand-900"
          title="Trésorerie"
        >
          <Wallet size={16} className="text-brand-600" />
          {wallet ? (
            <AnimatedNumber
              value={wallet.balance_usd}
              previousValue={previousBalance}
              format="usd"
            />
          ) : (
            "…"
          )}
        </div>

        <div
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-brand-50 px-3.5 text-sm font-semibold text-brand-900"
          title="Stockage utilisé / capacité totale — la capacité dépend du niveau de vos entrepôts, pas de leur superficie."
        >
          <Warehouse size={16} className="text-brand-600" />
          <span>
            {storage ? (
              <>
                <AnimatedNumber
                  value={storage.used}
                  previousValue={storageHistory.previous}
                />
                /{Math.round(storage.capacity)}
              </>
            ) : (
              "…"
            )}
          </span>
        </div>
      </div>

      <NavNotificationBell />
      <NavBurgerMenu />
    </header>
  );
}

"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { Sprout, ShoppingBag, Package, LineChart, Wallet, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePolledData, useMutationRefresh } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useWallet } from "@/lib/wallet-context";
import { NavTimeWeather } from "@/components/layout/NavTimeWeather";
import { NavNotificationBell } from "@/components/layout/NavNotificationBell";
import { NavBurgerMenu } from "@/components/layout/NavBurgerMenu";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

const NAV_ICONS = [
  { href: "/shop", label: "Boutique", title: "Boutique", icon: ShoppingBag },
  { href: "/inventory", label: "Inventaire", title: "Inventaire", icon: Package },
  { href: "/market", label: "Marché", title: "Marché", icon: LineChart },
];

export function Navbar() {
  const pathname = usePathname();
  const { wallet, previousBalance } = useWallet();
  const { data: storage, refresh: refreshStorage } = usePolledData(() => api.getStorage(), 10000);
  useMutationRefresh(refreshStorage);

  const previousUsedRef = useRef<number | null>(null);
  const lastSeenUsedRef = useRef<number | null>(null);
  if (storage && storage.used !== lastSeenUsedRef.current) {
    previousUsedRef.current = lastSeenUsedRef.current;
    lastSeenUsedRef.current = storage.used;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-20 shrink-0 items-center gap-4 border-b border-brand-800 bg-brand-900 px-5 md:px-8">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
          <Sprout size={21} />
        </span>
        <span className="hidden text-xl font-semibold tracking-tight text-white sm:inline">Verdance</span>
      </Link>

      <nav className="flex shrink-0 items-center gap-1.5">
        {NAV_ICONS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              aria-label={item.title}
              className={cn(
                "flex h-11 items-center gap-2 rounded-lg px-3.5 text-base font-medium transition-colors",
                active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <item.icon size={20} />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1" />

      <div className="flex min-w-0 items-center gap-2.5 overflow-x-auto py-1">
        <NavTimeWeather />

        <div
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3.5 text-sm font-semibold text-white"
          title="Trésorerie"
        >
          <Wallet size={16} className="text-brand-200" />
          {wallet ? (
            <AnimatedNumber value={wallet.balance_usd} previousValue={previousBalance} format="usd" />
          ) : (
            "…"
          )}
        </div>

        <div
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/10 px-3.5 text-sm font-semibold text-white"
          title="Stockage utilisé / capacité totale — la capacité dépend du niveau de vos entrepôts, pas de leur superficie."
        >
          <Warehouse size={16} className="text-brand-200" />
          <span>
            {storage ? (
              <>
                <AnimatedNumber value={storage.used} previousValue={previousUsedRef.current} />/
                {Math.round(storage.capacity)}
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

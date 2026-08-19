"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, User, Table2, Landmark, Settings, Receipt, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/lib/hooks";

const ITEMS = [
  { href: "/account", label: "Compte", icon: User },
  { href: "/parcels", label: "Gestion des parcelles", icon: Table2 },
  { href: "/invoices", label: "Factures", icon: Receipt },
  { href: "/history", label: "Historique des actions", icon: History },
  { href: "/bank", label: "Banque", icon: Landmark },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function NavBurgerMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useClickOutside(rootRef, () => setOpen(false), { escape: true });

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
          open ? "bg-white/20 text-white" : "text-white/85 hover:bg-white/10 hover:text-white",
        )}
      >
        <Menu size={21} />
      </button>

      {open && (
        <div className="animate-scale-in absolute right-0 top-14 z-30 w-56 origin-top-right rounded-xl border border-border bg-white p-1.5 shadow-xl">
          {ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground",
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

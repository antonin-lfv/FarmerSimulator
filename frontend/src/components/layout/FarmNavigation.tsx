"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sprout,
  Map,
  LandPlot,
  ShoppingBag,
  Package,
  ChartNoAxesCombined,
  Landmark,
  History,
  Settings,
  Receipt,
  UserRound,
} from "lucide-react";
const links = [
  { href: "/dashboard", label: "La ferme", icon: Map },
  { href: "/parcels", label: "Parcelles", icon: LandPlot },
  { href: "/shop", label: "Boutique", icon: ShoppingBag },
  { href: "/inventory", label: "Inventaire", icon: Package },
  { href: "/market", label: "Marché", icon: ChartNoAxesCombined },
  { href: "/bank", label: "Banque", icon: Landmark },
  { href: "/history", label: "Historique", icon: History },
  { href: "/invoices", label: "Factures", icon: Receipt },
];
export function FarmNavigation() {
  const pathname = usePathname();
  return (
    <aside className="farm-navigation">
      <Link
        href="/dashboard"
        className="farm-logo"
        aria-label="Verdance — La ferme"
      >
        <Sprout size={25} />
      </Link>
      <nav aria-label="Navigation principale">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "active" : ""}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <item.icon size={21} strokeWidth={1.65} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="farm-nav-footer">
        <Link href="/settings" aria-label="Paramètres" title="Paramètres">
          <Settings size={20} />
        </Link>
        <Link href="/account" aria-label="Mon compte" title="Mon compte">
          <UserRound size={19} />
        </Link>
      </div>
    </aside>
  );
}

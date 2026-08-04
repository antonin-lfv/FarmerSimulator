"use client";

import { useMemo, useState } from "react";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import { CatalogCard } from "@/components/shop/CatalogCard";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  vehicules: "Véhicules",
  accessoires: "Accessoires",
  packs: "Consommables",
};

export default function ShopPage() {
  const { data: catalog, refresh } = usePolledData(() => api.getCatalog(), 30000);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = useMemo(() => {
    if (!catalog) return [];
    return Array.from(new Set(catalog.map((item) => item.category)));
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    return activeCategory === "all" ? catalog : catalog.filter((item) => item.category === activeCategory);
  }, [catalog, activeCategory]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Boutique</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Véhicules, accessoires et intrants pour votre exploitation.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            activeCategory === "all"
              ? "bg-brand-600 text-white"
              : "bg-surface-sunken text-foreground-secondary hover:bg-brand-50",
          )}
        >
          Tout
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              activeCategory === cat
                ? "bg-brand-600 text-white"
                : "bg-surface-sunken text-foreground-secondary hover:bg-brand-50",
            )}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {!catalog ? (
        <p className="py-12 text-center text-sm text-foreground-muted">Chargement du catalogue…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-foreground-muted">Aucun article dans cette catégorie.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <CatalogCard key={item.item_id} item={item} onBought={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

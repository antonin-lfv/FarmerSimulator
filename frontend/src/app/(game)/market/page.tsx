"use client";

import { useEffect, useState } from "react";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { PriceChart } from "@/components/charts/PriceChart";
import { SellItemModal } from "@/components/shop/SellItemModal";
import { formatUsd, cn } from "@/lib/utils";
import type { InventoryItem, MarketPricePoint } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  harvest: "Récolte",
  packs: "Consommables",
};

// Mirrors backend market_service.PACK_SUBCATEGORY_TO_HARVEST — a harvest pack
// sells at the market price of its matching "harvest" subcategory, which
// isn't always spelled the same way ("graines céréales" pack -> "céréales"
// market price). Falls back to the pack's own subcategory when no mapping
// applies (e.g. "bois"/"raisins", already named like their harvest entry).
const PACK_SUBCATEGORY_TO_HARVEST: Record<string, string> = {
  "graines céréales": "céréales",
  "graines coton": "coton",
  "graines patates": "patates",
  "graines raisins": "raisins",
  "pousses arbres": "bois",
};

export default function MarketPage() {
  const { data: prices } = usePolledData(() => api.getMarketPrices(), 10000);
  const { data: inventory, refresh: refreshInventory } = usePolledData(() => api.getInventory(), 15000);

  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<MarketPricePoint[]>([]);
  const [sellItemId, setSellItemId] = useState<string>("");
  const [sellTarget, setSellTarget] = useState<InventoryItem | null>(null);

  const effectiveSelected = selected ?? prices?.[0]?.subcategory ?? null;

  useEffect(() => {
    if (!effectiveSelected) return;
    api.getMarketHistory(effectiveSelected).then(setHistory).catch(() => setHistory([]));
  }, [effectiveSelected]);

  const harvestItems = (inventory ?? []).filter((item) => item.category === "packs");

  function marketPriceFor(item: InventoryItem) {
    const harvestSubcategory = PACK_SUBCATEGORY_TO_HARVEST[item.subcategory] ?? item.subcategory;
    return prices?.find((p) => p.category === "harvest" && p.subcategory === harvestSubcategory)?.price ?? item.price;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Marché</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Prix en temps réel, historique et vente de récoltes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>{effectiveSelected ? `Historique — ${effectiveSelected}` : "Historique"}</CardTitle>
          </CardHeader>
          <CardBody>
            {history.length === 0 ? (
              <p className="py-16 text-center text-sm text-foreground-muted">
                Sélectionnez un article pour voir son historique.
              </p>
            ) : (
              <PriceChart data={history} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Vendre une récolte
              <InfoTip text="Payée au prix du marché du jour pour cette récolte — le prix bouge chaque jour de jeu, donc le montant peut différer d'une vente à l'autre même sans rien changer." />
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {harvestItems.length === 0 ? (
              <p className="text-sm text-foreground-muted">Aucune récolte disponible à la vente.</p>
            ) : (
              <>
                <Select value={sellItemId} onChange={(e) => setSellItemId(e.target.value)}>
                  <option value="">Choisir un article</option>
                  {harvestItems.map((item) => (
                    <option key={item.item_id} value={item.item_id}>
                      {item.name} ({item.amount} en stock)
                    </option>
                  ))}
                </Select>
                <Button
                  onClick={() => setSellTarget(harvestItems.find((i) => i.item_id === Number(sellItemId)) ?? null)}
                  disabled={!sellItemId}
                >
                  Vendre
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-sunken text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
            <tr>
              <th className="px-5 py-3">Catégorie</th>
              <th className="px-5 py-3">Article</th>
              <th className="px-5 py-3 text-right">
                <span className="inline-flex items-center gap-1">
                  Prix
                  <InfoTip text="Recalculé une fois par jour de jeu : petit bruit aléatoire autour d'une moyenne propre à chaque article, avec occasionnellement un pic ou une chute plus marquée." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(prices ?? []).map((price) => (
              <tr
                key={`${price.category}-${price.subcategory}`}
                onClick={() => setSelected(price.subcategory)}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-surface-sunken",
                  effectiveSelected === price.subcategory && "bg-brand-50",
                )}
              >
                <td className="px-5 py-3 text-foreground-secondary">
                  {CATEGORY_LABELS[price.category] ?? price.category}
                </td>
                <td className="px-5 py-3 font-medium capitalize text-foreground">
                  {price.subcategory}
                </td>
                <td className="px-5 py-3 text-right text-foreground">{formatUsd(price.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SellItemModal
        item={sellTarget ? { name: sellTarget.name, img_path: sellTarget.img_path, price: marketPriceFor(sellTarget) } : null}
        ownedQuantity={sellTarget?.amount ?? 0}
        open={sellTarget != null}
        onClose={() => setSellTarget(null)}
        onConfirm={async (quantity) => {
          if (!sellTarget) return { success: false, message: "Aucun article sélectionné." };
          const result = await api.sellHarvest(sellTarget.item_id, quantity);
          if (result.success) {
            await refreshInventory();
            setSellItemId("");
          }
          return result;
        }}
      />
    </div>
  );
}

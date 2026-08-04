"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SellItemModal } from "@/components/shop/SellItemModal";
import { resolveImagePath } from "@/lib/assets";
import { formatUsd } from "@/lib/utils";
import type { InventoryItem } from "@/lib/types";

export default function InventoryPage() {
  const { data: inventory, refresh } = usePolledData(() => api.getInventory(), 10000);
  const [sellTarget, setSellTarget] = useState<InventoryItem | null>(null);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventaire</h1>
        <p className="mt-1 text-sm text-foreground-secondary">Ce que possède votre exploitation.</p>
      </div>

      {!inventory ? (
        <p className="py-12 text-center text-sm text-foreground-muted">Chargement de l&apos;inventaire…</p>
      ) : inventory.length === 0 ? (
        <p className="py-12 text-center text-sm text-foreground-muted">Votre inventaire est vide.</p>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-sunken text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-5 py-3">Article</th>
                <th className="px-5 py-3">Catégorie</th>
                <th className="px-5 py-3 text-right">Quantité</th>
                <th className="px-5 py-3 text-right">Valeur unitaire</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventory.map((item) => {
                const img = resolveImagePath(item.img_path);
                return (
                  <tr key={item.item_id}>
                    <td className="px-5 py-3">
                      <Link href={`/catalog/${item.item_id}?from=inventory`} className="flex items-center gap-3 w-fit">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-sunken">
                          {img ? (
                            <Image src={img} alt={item.name} width={36} height={36} className="object-contain" />
                          ) : (
                            <Package size={16} className="text-foreground-muted" />
                          )}
                        </span>
                        <span className="font-medium text-foreground hover:text-brand-700">{item.name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 capitalize text-foreground-secondary">{item.subcategory}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.amount}</td>
                    <td className="px-5 py-3 text-right text-foreground-muted">
                      {formatUsd(item.price)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setSellTarget(item)}>
                        Vendre
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <SellItemModal
        item={sellTarget}
        ownedQuantity={sellTarget?.amount ?? 0}
        open={sellTarget != null}
        onClose={() => setSellTarget(null)}
        onConfirm={async (quantity) => {
          if (!sellTarget) return { success: false, message: "Aucun article sélectionné." };
          const result = await api.sellInventoryItem(sellTarget.item_id, quantity);
          if (result.success) await refresh();
          return result;
        }}
      />
    </div>
  );
}

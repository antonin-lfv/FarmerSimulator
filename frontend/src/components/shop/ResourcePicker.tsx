"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { BuyItemModal } from "@/components/shop/BuyItemModal";
import { cn, decodeResourceValue, encodeResourceValue, formatUsd } from "@/lib/utils";
import type { CatalogItem } from "@/lib/types";

// One resource requirement's picker — a plain "own" dropdown plus, for anything
// rentable (vehicles/accessories, never packs), a "louer" option that bypasses
// ownership entirely. Shared by the single-parcel action form and the bulk
// action modal so both offer the exact same buy/rent/own choices.
export function ResourcePicker({
  subcategory,
  amountLabel,
  requiredAmount = 1,
  catalog,
  value,
  onChange,
  onRefreshCatalog,
}: {
  subcategory: string;
  /** What to show next to the subcategory name, e.g. "x1" or "x1/ha". */
  amountLabel: string;
  /** Prefills the buy modal's quantity stepper — the amount this action actually needs. */
  requiredAmount?: number;
  catalog: CatalogItem[];
  value: string;
  onChange: (value: string) => void;
  onRefreshCatalog: () => Promise<void>;
}) {
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const options = catalog.filter((item) => item.subcategory === subcategory);
  const canRent = options.some((item) => item.category !== "packs");
  const decoded = decodeResourceValue(value);
  const selectedItem = decoded ? options.find((i) => i.item_id === decoded.itemId) : undefined;
  const buyTarget = selectedItem ?? [...options].sort((a, b) => a.price - b.price)[0];
  const needsPurchase = Boolean(buyTarget && buyTarget.available_now === 0);

  function handleBought(itemId: number) {
    onRefreshCatalog();
    if (!decoded) onChange(encodeResourceValue(itemId, "own"));
  }

  return (
    <div>
      <label className="text-sm font-medium text-foreground-secondary">
        {subcategory} <span className="text-foreground-muted">({amountLabel})</span>
        <div className="mt-1.5 flex gap-2">
          <Select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1">
            <option value="">Choisir un article</option>
            {options.map((item) => (
              <option
                key={`own-${item.item_id}`}
                value={encodeResourceValue(item.item_id, "own")}
                disabled={item.available_now === 0}
              >
                {item.name}{" "}
                {item.available_now > 0
                  ? `(disponible x${item.available_now})`
                  : item.amount_owned > 0
                    ? "(déjà utilisé ailleurs)"
                    : "(non possédé)"}
              </option>
            ))}
            {canRent &&
              options
                .filter((item) => item.category !== "packs" && item.rental_price != null)
                .map((item) => (
                  <option key={`rent-${item.item_id}`} value={encodeResourceValue(item.item_id, "rent")}>
                    {item.name} — louer à {formatUsd(item.rental_price ?? 0)}/utilisation
                  </option>
                ))}
          </Select>
          {buyTarget && (
            <button
              type="button"
              onClick={() => setBuyModalOpen(true)}
              title="Acheter"
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg border px-3.5 transition-colors",
                needsPurchase
                  ? "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
                  : "border-border bg-white text-foreground-secondary hover:bg-surface-sunken",
              )}
            >
              <ShoppingCart size={16} />
            </button>
          )}
        </div>
      </label>

      {buyTarget && (
        <BuyItemModal
          options={options}
          initialItemId={buyTarget.item_id}
          defaultQuantity={requiredAmount}
          open={buyModalOpen}
          onClose={() => setBuyModalOpen(false)}
          onBought={handleBought}
        />
      )}
    </div>
  );
}

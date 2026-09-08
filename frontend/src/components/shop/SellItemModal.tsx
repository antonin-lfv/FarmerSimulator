"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Package, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatUsd } from "@/lib/utils";
import { resolveImagePath } from "@/lib/assets";
import { useToast } from "@/components/ui/ToastProvider";

export interface SellableItem {
  name: string;
  img_path: string;
  /** Unit price the sale pays out — a static catalog price or a live market price, the caller decides. */
  price: number;
}

interface SellItemModalProps {
  item: SellableItem | null;
  ownedQuantity: number;
  open: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => Promise<{ success: boolean; message: string }>;
}

export function SellItemModal({ item, ownedQuantity, open, onClose, onConfirm }: SellItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const push = useToast();

  if (!open || !item) return null;

  const img = resolveImagePath(item.img_path);
  const maxQuantity = Math.max(1, Math.floor(ownedQuantity));
  const saleQuantity = Math.min(maxQuantity, Math.max(1, Math.floor(quantity)));
  const total = item.price * saleQuantity;

  function chooseQuantity(nextQuantity: number) {
    setQuantity(Math.min(maxQuantity, Math.max(1, Math.floor(nextQuantity))));
    setError(null);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm(saleQuantity);
      if (!result.success) {
        setError(result.message);
        push({ tone: "error", title: `Vente impossible — ${item!.name}`, description: result.message });
        return;
      }
      push({ tone: "success", title: "Vente confirmée", description: `${item!.name} × ${saleQuantity}` });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Vendre" className="max-w-2xl">
      <div className="flex flex-col gap-7">
        <div className="flex items-center gap-6">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-sunken">
            {img ? (
              <Image src={img} alt={item.name} width={116} height={116} className="object-contain p-2" />
            ) : (
              <Package size={40} className="text-foreground-muted" />
            )}
          </div>
          <div>
            <p className="text-2xl font-semibold text-foreground">{item.name}</p>
            <p className="mt-1 text-base text-foreground-muted">
              {formatUsd(item.price)} / unité — {ownedQuantity} en stock
            </p>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="sale-quantity" className="text-base font-medium text-foreground-secondary">
              Quantité
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => chooseQuantity(saleQuantity - 1)}
                aria-label="Retirer une unité"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors hover:bg-surface-sunken"
              >
                <Minus size={17} />
              </button>
              <input
                id="sale-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQuantity}
                value={saleQuantity}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => chooseQuantity(Number(event.target.value))}
                className="h-11 w-28 rounded-lg border border-border bg-white px-3 text-center text-xl font-medium text-foreground outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="button"
                onClick={() => chooseQuantity(saleQuantity + 1)}
                aria-label="Ajouter une unité"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors hover:bg-surface-sunken"
              >
                <Plus size={17} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {[
              { label: "25 %", value: Math.ceil(maxQuantity * 0.25) },
              { label: "50 %", value: Math.ceil(maxQuantity * 0.5) },
              { label: "Tout", value: maxQuantity },
            ].map((choice) => (
              <button
                key={choice.label}
                type="button"
                onClick={() => chooseQuantity(choice.value)}
                className="rounded-full border border-border bg-white px-4 py-1.5 text-sm font-medium text-foreground-secondary transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-6 py-5">
          <span className="text-base text-foreground-secondary">Vous recevrez</span>
          <span className="text-2xl font-semibold text-foreground">{formatUsd(total)}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button size="lg" className="py-3.5 text-base" onClick={handleConfirm} disabled={busy} variant="secondary">
          Confirmer la vente
        </Button>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Minus, Package, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { resolveImagePath } from "@/lib/assets";
import { useToast } from "@/components/ui/ToastProvider";

export interface BuyableItem {
  item_id: number;
  name: string;
  price: number;
  img_path: string;
}

interface BuyItemModalProps {
  /** All variants the shopper can browse — a single-item array just hides the arrows. */
  options: BuyableItem[];
  /** Which item_id to open on. Defaults to the first option. */
  initialItemId?: number;
  defaultQuantity?: number;
  open: boolean;
  onClose: () => void;
  onBought: (itemId: number) => void;
}

export function BuyItemModal({
  options,
  initialItemId,
  defaultQuantity = 1,
  open,
  onClose,
  onBought,
}: BuyItemModalProps) {
  const [index, setIndex] = useState(0);
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const push = useToast();

  useEffect(() => {
    if (!open) return;
    const startIndex = Math.max(0, options.findIndex((o) => o.item_id === initialItemId));
    setIndex(startIndex);
    setQuantity(defaultQuantity);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when the modal opens
  }, [open]);

  const item = options[index];
  if (!open || !item) return null;

  const img = resolveImagePath(item.img_path);
  const total = item.price * quantity;
  const hasPrev = index > 0;
  const hasNext = index < options.length - 1;

  function changeVariant(nextIndex: number) {
    setIndex(nextIndex);
    setQuantity(defaultQuantity);
    setError(null);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.buyCatalogItem(item.item_id, quantity);
      if (!result.success) {
        setError(result.message);
        push({ tone: "error", title: `Achat impossible — ${item.name}`, description: result.message });
        return;
      }
      push({
        tone: "success",
        title: `Achat confirmé — ${item.name}`,
        description: `${quantity} × ${formatUsd(item.price)} = ${formatUsd(total)}`,
      });
      onBought(item.item_id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Acheter" className="max-w-2xl">
      <div className="flex flex-col gap-7">
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => changeVariant(index - 1)}
            disabled={!hasPrev}
            title="Modèle précédent"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="flex flex-1 items-center gap-6">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-sunken">
              {img ? (
                <Image src={img} alt={item.name} width={116} height={116} className="object-contain p-2" />
              ) : (
                <Package size={40} className="text-foreground-muted" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold text-foreground">{item.name}</p>
              <p className="mt-1 text-base text-foreground-muted">{formatUsd(item.price)} / unité</p>
              {options.length > 1 && (
                <p className="mt-1 text-sm text-foreground-muted">
                  Modèle {index + 1} / {options.length}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => changeVariant(index + 1)}
            disabled={!hasNext}
            title="Modèle suivant"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-foreground-secondary">Quantité</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors hover:bg-surface-sunken"
            >
              <Minus size={17} />
            </button>
            <span className="w-10 text-center text-xl font-medium text-foreground">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors hover:bg-surface-sunken"
            >
              <Plus size={17} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-6 py-5">
          <span className="text-base text-foreground-secondary">Total</span>
          <span className="text-2xl font-semibold text-foreground">{formatUsd(total)}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button size="lg" className="py-3.5 text-base" onClick={handleConfirm} disabled={busy}>
          Confirmer l&apos;achat
        </Button>
      </div>
    </Modal>
  );
}

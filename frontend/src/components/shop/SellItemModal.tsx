"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (open) {
      setQuantity(Math.min(1, ownedQuantity) || 1);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when the modal opens
  }, [open]);

  if (!open || !item) return null;

  const img = resolveImagePath(item.img_path);
  const total = item.price * quantity;
  const maxQuantity = Math.max(1, ownedQuantity);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm(quantity);
      if (!result.success) {
        setError(result.message);
        push({ tone: "error", title: `Vente impossible — ${item!.name}`, description: result.message });
        return;
      }
      push({ tone: "success", title: "Vente confirmée", description: `${item!.name} × ${quantity}` });
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
              onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground-secondary transition-colors hover:bg-surface-sunken"
            >
              <Plus size={17} />
            </button>
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

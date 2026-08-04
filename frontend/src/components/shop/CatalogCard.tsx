"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BuyItemModal } from "@/components/shop/BuyItemModal";
import type { CatalogItem } from "@/lib/types";
import { formatUsd } from "@/lib/utils";
import { resolveImagePath } from "@/lib/assets";

export function CatalogCard({ item, onBought }: { item: CatalogItem; onBought: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const img = resolveImagePath(item.img_path);
  const discounted = item.promotion > 0;
  const finalPrice = discounted ? item.price * (1 - item.promotion / 100) : item.price;

  return (
    <Card className="flex flex-col overflow-hidden">
      <Link href={`/catalog/${item.item_id}?from=shop`} className="contents">
        <div className="relative flex aspect-square items-center justify-center bg-surface-sunken transition-opacity hover:opacity-90">
          {img ? (
            <Image src={img} alt={item.name} fill className="object-contain p-6" />
          ) : (
            <Package size={32} className="text-foreground-muted" />
          )}
          {discounted && (
            <span className="absolute right-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
              -{item.promotion}%
            </span>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
          {item.subcategory}
        </span>
        <Link href={`/catalog/${item.item_id}?from=shop`} className="w-fit">
          <h3 className="text-sm font-semibold text-foreground hover:text-brand-700">{item.name}</h3>
        </Link>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-foreground">{formatUsd(finalPrice)}</span>
            {discounted && (
              <span className="text-xs text-foreground-muted line-through">{formatUsd(item.price)}</span>
            )}
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            Acheter
          </Button>
        </div>
      </div>

      <BuyItemModal
        options={[item]}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onBought={onBought}
      />
    </Card>
  );
}

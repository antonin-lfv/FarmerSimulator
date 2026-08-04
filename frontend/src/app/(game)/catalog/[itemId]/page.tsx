"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Package, Calendar, Info, Wrench } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { BuyItemModal } from "@/components/shop/BuyItemModal";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { resolveImagePath } from "@/lib/assets";

const CATEGORY_LABELS: Record<string, string> = {
  vehicules: "Véhicule",
  accessoires: "Accessoire",
  packs: "Consommable",
};

const BACK_TARGETS: Record<string, { href: string; label: string }> = {
  shop: { href: "/shop", label: "Retour à la boutique" },
  inventory: { href: "/inventory", label: "Retour à l'inventaire" },
};

export default function CatalogDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = use(params);
  const id = Number(itemId);
  const { data: item, refresh } = usePolledData(() => api.getCatalogDetail(id), 10000);
  const [modalOpen, setModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const back = BACK_TARGETS[searchParams.get("from") ?? ""] ?? BACK_TARGETS.shop;

  if (!item) {
    return (
      <div className="mx-auto max-w-5xl py-12 text-center text-sm text-foreground-muted">
        Chargement de la fiche…
      </div>
    );
  }

  const img = resolveImagePath(item.img_path);
  const discounted = item.promotion > 0;
  const finalPrice = discounted ? item.price * (1 - item.promotion / 100) : item.price;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link
        href={back.href}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft size={15} />
        {back.label}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="overflow-hidden">
          <div className="relative flex aspect-square items-center justify-center bg-surface-sunken">
            {img ? (
              <Image src={img} alt={item.name} fill className="object-contain p-8" />
            ) : (
              <Package size={48} className="text-foreground-muted" />
            )}
            {discounted && (
              <span className="absolute right-3 top-3 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
                -{item.promotion}%
              </span>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{CATEGORY_LABELS[item.category] ?? item.category}</Badge>
              <Badge tone="neutral">{item.subcategory}</Badge>
              {item.amount_owned > 0 && <Badge tone="warning">Possédé ×{item.amount_owned}</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{item.name}</h1>
            <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">{item.description}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-foreground">{formatUsd(finalPrice)}</span>
              {discounted && (
                <span className="text-sm text-foreground-muted line-through">{formatUsd(item.price)}</span>
              )}
            </div>
            <Button onClick={() => setModalOpen(true)}>Acheter</Button>
            {item.rental_price != null && (
              <span className="flex items-center gap-1 text-xs text-foreground-muted">
                ou location : {formatUsd(item.rental_price)} / utilisation
                <InfoTip text="Un prestataire amène le matériel pour une seule action, payé à chaque utilisation — aucun achat, aucune limite de disponibilité, mais rien ne reste dans votre inventaire ensuite. Pratique pour une action ponctuelle ou groupée sans immobiliser votre trésorerie." />
              </span>
            )}
          </div>

          {item.specs.length > 0 && (
            <Card>
              <CardBody className="grid grid-cols-2 gap-x-6 gap-y-3">
                {item.specs.map((spec) => (
                  <div key={spec.label}>
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                      {spec.label}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{spec.value}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {item.best_period && (
            <div className="flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
              <Calendar size={16} className="mt-0.5 shrink-0 text-brand-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Meilleure période</p>
                <p className="mt-0.5 text-sm text-brand-800">{item.best_period}</p>
              </div>
            </div>
          )}

          {item.usage.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                <Wrench size={13} />
                Utilisation
              </p>
              <ul className="flex flex-col gap-1.5">
                {item.usage.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-sm text-foreground-secondary">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground-muted" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.specs.length === 0 && item.usage.length === 0 && !item.best_period && (
            <p className="flex items-center gap-2 text-sm text-foreground-muted">
              <Info size={14} />
              Consommable simple, sans caractéristique particulière.
            </p>
          )}
        </div>
      </div>

      <BuyItemModal
        options={[item]}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onBought={() => refresh()}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { ResourcePicker } from "@/components/shop/ResourcePicker";
import { useToast } from "@/components/ui/ToastProvider";
import { useWallet } from "@/lib/wallet-context";
import { api } from "@/lib/api";
import { decodeResourceValue, estimateActionCost, formatUsd } from "@/lib/utils";
import type { CatalogItem, Parcel, PossibleAction, ResourceMode } from "@/lib/types";

interface BulkActionModalProps {
  open: boolean;
  onClose: () => void;
  action: PossibleAction;
  eligibleParcels: Parcel[];
  catalog: CatalogItem[];
  onRefreshCatalog: () => Promise<void>;
  /** Called after the batch runs so the caller can refresh its parcel list. */
  onDone: () => void;
}

export function BulkActionModal({
  open,
  onClose,
  action,
  eligibleParcels,
  catalog,
  onRefreshCatalog,
  onDone,
}: BulkActionModalProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const push = useToast();
  const { wallet } = useWallet();
  const eligibleCount = eligibleParcels.length;
  const requirements = action.requirements;
  const selectionComplete = requirements.every((requirement) =>
    Boolean(decodeResourceValue(selections[requirement.subcategory])),
  );
  const estimate = estimateActionCost(
    action,
    eligibleParcels.map((parcel) => parcel.superficie),
    selections,
    catalog,
  );
  const totalCost = selectionComplete ? estimate.totalCost : null;
  const balance = wallet?.balance_usd ?? null;
  const missingAmount = totalCost !== null && balance !== null ? Math.max(0, totalCost - balance) : 0;
  const insufficientFunds = missingAmount > 0;

  if (!open) return null;

  async function handleConfirm() {
    const resources = requirements.map((req) => {
      const decoded = decodeResourceValue(selections[req.subcategory]);
      return {
        subcategory: req.subcategory,
        item_id: decoded?.itemId ?? 0,
        mode: (decoded?.mode ?? "own") as ResourceMode,
      };
    });
    if (resources.some((r) => !r.item_id)) {
      setError("Sélectionnez un article pour chaque ressource requise.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.bulkStartAction(action.action_type, resources);
      const parts = [`${result.started} lancée(s)`];
      if (result.failures.length > 0) parts.push(`${result.failures.length} échouée(s)`);
      push({
        tone: result.started > 0 ? "success" : "error",
        title: `Action groupée — ${action.action_type}`,
        description:
          parts.join(", ") + (result.failures.length > 0 ? ` (ex : ${result.failures[0].message})` : ""),
      });
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Action groupée" className="max-w-2xl">
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border p-4">
          <p className="font-medium capitalize text-foreground">{action.action_type}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            {eligibleCount} parcelle{eligibleCount > 1 ? "s" : ""} concernée{eligibleCount > 1 ? "s" : ""} par cette
            action.
          </p>
        </div>

        {requirements.map((req) => (
          <ResourcePicker
            key={req.subcategory}
            subcategory={req.subcategory}
            amountLabel="quantité par parcelle selon sa superficie"
            catalog={catalog}
            value={selections[req.subcategory] ?? ""}
            onChange={(value) => setSelections((cur) => ({ ...cur, [req.subcategory]: value }))}
            onRefreshCatalog={onRefreshCatalog}
          />
        ))}

        <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken px-4 py-3">
          <div className="flex items-center justify-between text-sm text-foreground-secondary">
            <span>Main d&apos;œuvre pour {eligibleCount} parcelle{eligibleCount > 1 ? "s" : ""}</span>
            <span className="font-medium text-foreground">
              {selectionComplete ? formatUsd(estimate.laborCost) : "À calculer"}
            </span>
          </div>
          {selectionComplete && estimate.rentalCost > 0 && (
            <div className="flex items-center justify-between text-sm text-foreground-secondary">
              <span>Locations du matériel</span>
              <span className="font-medium text-foreground">{formatUsd(estimate.rentalCost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Wallet size={15} />
              Coût total si toutes démarrent
              <InfoTip text="Somme de la main-d'œuvre calculée selon la superficie de chaque parcelle, plus une location de chaque matériel sélectionné par parcelle." />
            </span>
            <span className="text-lg font-semibold text-foreground">
              {totalCost === null ? "—" : formatUsd(totalCost)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Votre solde</span>
            <span className={insufficientFunds ? "font-medium text-red-600" : "font-medium text-brand-700"}>
              {balance === null ? "Chargement…" : formatUsd(balance)}
            </span>
          </div>
          {insufficientFunds && (
            <p className="text-sm font-medium text-red-600">
              Il manque {formatUsd(missingAmount)} pour lancer tout le lot.
            </p>
          )}
        </div>

        <p className="text-xs text-foreground-muted">
          Toutes les parcelles concernées démarrent en une fois — seul le matériel possédé peut limiter
          certaines d&apos;entre elles (ex. un seul tracteur pour plusieurs parcelles) ; celles-ci seront
          signalées comme échouées, relancez l&apos;action groupée une fois le matériel libéré.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          size="lg"
          className="py-3.5 text-base"
          onClick={handleConfirm}
          disabled={busy || !selectionComplete || insufficientFunds}
        >
          {insufficientFunds
            ? `Solde insuffisant · manque ${formatUsd(missingAmount)}`
            : totalCost === null
              ? "Choisissez les ressources"
              : `Lancer sur toutes (${eligibleCount}) · ${formatUsd(totalCost)}`}
        </Button>
      </div>
    </Modal>
  );
}

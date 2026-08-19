"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ResourcePicker } from "@/components/shop/ResourcePicker";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";
import { decodeResourceValue } from "@/lib/utils";
import type { ActionRequirement, CatalogItem, ResourceMode } from "@/lib/types";

interface BulkActionModalProps {
  open: boolean;
  onClose: () => void;
  actionType: string;
  eligibleCount: number;
  requirements: ActionRequirement[];
  catalog: CatalogItem[];
  onRefreshCatalog: () => Promise<void>;
  /** Called after the batch runs so the caller can refresh its parcel list. */
  onDone: () => void;
}

export function BulkActionModal({
  open,
  onClose,
  actionType,
  eligibleCount,
  requirements,
  catalog,
  onRefreshCatalog,
  onDone,
}: BulkActionModalProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const push = useToast();

  useEffect(() => {
    if (open) {
      setSelections({});
      setError(null);
    }
  }, [open]);

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
      const result = await api.bulkStartAction(actionType, resources);
      const parts = [`${result.started} lancée(s)`];
      if (result.failures.length > 0) parts.push(`${result.failures.length} échouée(s)`);
      push({
        tone: result.started > 0 ? "success" : "error",
        title: `Action groupée — ${actionType}`,
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
          <p className="font-medium capitalize text-foreground">{actionType}</p>
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

        <p className="text-xs text-foreground-muted">
          Toutes les parcelles concernées démarrent en une fois — seul le matériel possédé peut limiter
          certaines d&apos;entre elles (ex. un seul tracteur pour plusieurs parcelles) ; celles-ci seront
          signalées comme échouées, relancez l&apos;action groupée une fois le matériel libéré.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button size="lg" className="py-3.5 text-base" onClick={handleConfirm} disabled={busy}>
          Lancer sur toutes ({eligibleCount})
        </Button>
      </div>
    </Modal>
  );
}

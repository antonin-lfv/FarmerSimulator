"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FarmMap } from "@/components/map/FarmMap";
import { ParcelPanel } from "@/components/map/ParcelPanel";
import { WeatherCard } from "@/components/weather/WeatherCard";
import { usePolledData } from "@/lib/hooks";
import { useCalendar } from "@/lib/calendar-context";
import { useWallet } from "@/lib/wallet-context";
import { api } from "@/lib/api";
import type { ParcelDetail, ResourceMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FarmManager({
  initialParcelId = null,
  compact = false,
}: {
  initialParcelId?: number | null;
  compact?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<ParcelDetail | null>(null);
  const [loadingParcel, setLoadingParcel] = useState(false);

  const { wallet } = useWallet();
  const { data: parcels, refresh: refreshParcels } = usePolledData(() => api.getParcels(), 8000);
  const { data: ongoingActions, refresh: refreshActions } = usePolledData(
    () => api.getOngoingActions(),
    2000,
  );
  const { data: catalog, refresh: refreshCatalog } = usePolledData(() => api.getCatalog(), 10000);
  // Shared context (4s poll) instead of a local one (was 15s) — keeps the
  // map's weather bubble in sync with the navbar/weather card instead of
  // lagging behind on every day change.
  const { calendar } = useCalendar();

  const loadParcel = useCallback(async (parcelId: number) => {
    setSelectedId(parcelId);
    setLoadingParcel(true);
    try {
      const detail = await api.getParcel(parcelId);
      setSelectedParcel(detail);
    } finally {
      setLoadingParcel(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from a prop/URL on mount
    if (initialParcelId) loadParcel(initialParcelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBuy() {
    if (!selectedId) return { success: false, message: "Aucune parcelle sélectionnée." };
    const result = await api.buyParcel(selectedId);
    if (result.success) {
      await Promise.all([loadParcel(selectedId), refreshParcels()]);
    }
    return result;
  }

  async function handleUpgradeStorage() {
    if (!selectedId) return { success: false, message: "Aucune parcelle sélectionnée." };
    const result = await api.upgradeStorage(selectedId);
    if (result.success) {
      await loadParcel(selectedId);
    }
    return result;
  }

  async function handleProtect() {
    if (!selectedId) return { success: false, message: "Aucune parcelle sélectionnée." };
    const result = await api.protectParcel(selectedId);
    if (result.success) {
      await loadParcel(selectedId);
    }
    return result;
  }

  async function handleStartAction(
    actionType: string,
    resources: { subcategory: string; item_id: number; mode: ResourceMode }[],
  ) {
    if (!selectedId) return { success: false, message: "Aucune parcelle sélectionnée." };
    const result = await api.startAction(selectedId, { action_type: actionType, resources });
    if (result.success) {
      await Promise.all([loadParcel(selectedId), refreshActions(), refreshCatalog()]);
    }
    return result;
  }

  const ongoingForSelected = ongoingActions?.find((a) => a.parcel_id === selectedId);

  // When the selected parcel's action finishes server-side (the scheduler
  // completes it), the parcel detail we hold in state goes stale — it still
  // shows the just-finished action instead of the next one in the cycle.
  // Reload it the moment `ongoingForSelected` disappears.
  const hadOngoingRef = useRef(false);
  useEffect(() => {
    if (ongoingForSelected) {
      hadOngoingRef.current = true;
    } else if (hadOngoingRef.current && selectedId) {
      hadOngoingRef.current = false;
      loadParcel(selectedId);
    }
  }, [ongoingForSelected, selectedId, loadParcel]);

  return (
    <div
      className={cn("grid gap-6", compact ? "lg:grid-cols-[54rem_1fr]" : "lg:grid-cols-[1fr_320px]")}
    >
      {!parcels || !ongoingActions ? (
        <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-surface text-sm text-foreground-muted">
          Chargement du plan…
        </div>
      ) : (
        <FarmMap
          parcels={parcels}
          ongoingActions={ongoingActions}
          selectedId={selectedId}
          onSelect={loadParcel}
          walletBalance={wallet?.balance_usd}
          weather={calendar?.weather}
        />
      )}

      <div className="flex flex-col gap-6">
        {compact && (
          <div className="shrink-0">
            <WeatherCard />
          </div>
        )}
        <ParcelPanel
          parcel={selectedParcel}
          loading={loadingParcel}
          ongoingAction={ongoingForSelected}
          catalog={catalog ?? []}
          weather={calendar?.weather}
          onRefreshCatalog={refreshCatalog}
          onBuy={handleBuy}
          onUpgradeStorage={handleUpgradeStorage}
          onProtect={handleProtect}
          onStartAction={handleStartAction}
        />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FarmMap } from "@/components/map/FarmMap";
import { ParcelPanel } from "@/components/map/ParcelPanel";
import {
  ArrowUpRight,
  ArrowLeft,
  LandPlot,
  Sprout,
  Timer,
  X,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useMutationRefresh, usePolledData } from "@/lib/hooks";
import { useCalendar } from "@/lib/calendar-context";
import { useWallet } from "@/lib/wallet-context";
import { api } from "@/lib/api";
import type { ParcelDetail, ResourceMode } from "@/lib/types";
import { formatDuration, SURFACE_LABELS } from "@/lib/utils";

export function FarmManager({
  initialParcelId = null,
  compact = false,
}: {
  initialParcelId?: number | null;
  compact?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<ParcelDetail | null>(
    null,
  );
  const [loadingParcel, setLoadingParcel] = useState(false);

  const [parcelError, setParcelError] = useState<string | null>(null);
  const selectionRequest = useRef(0);
  const inspectorRef = useRef<HTMLElement>(null);
  const { wallet } = useWallet();
  const {
    data: parcels,
    error: parcelsError,
    refresh: refreshParcels,
  } = usePolledData(() => api.getParcels(), 8000);
  const { data: ongoingActions, refresh: refreshActions } = usePolledData(
    () => api.getOngoingActions(),
    2000,
  );
  const { data: catalog, refresh: refreshCatalog } = usePolledData(
    () => api.getCatalog(),
    10000,
  );
  // Shared context (4s poll) instead of a local one (was 15s) — keeps the
  // map's weather bubble in sync with the navbar/weather card instead of
  // lagging behind on every day change.
  const { calendar } = useCalendar();

  useMutationRefresh(refreshParcels);
  useMutationRefresh(refreshActions);

  const loadParcel = useCallback(async (parcelId: number) => {
    const request = ++selectionRequest.current;
    setSelectedId(parcelId);
    setSelectedParcel(null);
    setParcelError(null);
    setLoadingParcel(true);
    try {
      const detail = await api.getParcel(parcelId);
      if (request === selectionRequest.current) setSelectedParcel(detail);
    } catch {
      if (request === selectionRequest.current)
        setParcelError(
          "Impossible de charger cette parcelle. Réessayez dans un instant.",
        );
    } finally {
      if (request === selectionRequest.current) setLoadingParcel(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from a prop/URL on mount
    if (initialParcelId) loadParcel(initialParcelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      selectedId !== null &&
      !loadingParcel &&
      window.matchMedia("(max-width: 700px)").matches
    ) {
      inspectorRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }, [selectedId, loadingParcel]);

  async function handleBuy() {
    if (!selectedId)
      return { success: false, message: "Aucune parcelle sélectionnée." };
    const result = await api.buyParcel(selectedId);
    if (result.success) {
      await Promise.all([loadParcel(selectedId), refreshParcels()]);
    }
    return result;
  }

  async function handleUpgradeStorage() {
    if (!selectedId)
      return { success: false, message: "Aucune parcelle sélectionnée." };
    const result = await api.upgradeStorage(selectedId);
    if (result.success) {
      await loadParcel(selectedId);
    }
    return result;
  }

  async function handleProtect() {
    if (!selectedId)
      return { success: false, message: "Aucune parcelle sélectionnée." };
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
    if (!selectedId)
      return { success: false, message: "Aucune parcelle sélectionnée." };
    const result = await api.startAction(selectedId, {
      action_type: actionType,
      resources,
    });
    if (result.success) {
      await Promise.all([
        loadParcel(selectedId),
        refreshActions(),
        refreshCatalog(),
      ]);
    }
    return result;
  }

  const ongoingForSelected = ongoingActions?.find(
    (a) => a.parcel_id === selectedId,
  );

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

  const owned = parcels?.filter((p) => p.is_purchased) ?? [];
  const totalArea = owned.reduce((sum, p) => sum + p.superficie, 0);
  function closeParcel() {
    selectionRequest.current++;
    setSelectedId(null);
    setSelectedParcel(null);
    setParcelError(null);
    setLoadingParcel(false);
  }

  return (
    <section
      className={`farm-manager ${compact ? "farm-manager-immersive" : ""}`}
    >
      {compact && (
        <div className="farm-heading">
          <div>
            <div className="farm-eyebrow">
              <span /> VOTRE EXPLOITATION, EN DIRECT
            </div>
            <h1>La vie au grand air.</h1>
          </div>
          <div className="farm-heading-stats">
            <div>
              <LandPlot size={18} />
              <strong>{owned.length}</strong>
              <span>{owned.length === 1 ? "parcelle" : "parcelles"}</span>
            </div>
            <div>
              <Sprout size={18} />
              <strong>{totalArea.toLocaleString("fr-FR")}</strong>
              <span>hectares</span>
            </div>
            <div>
              <Timer size={18} />
              <strong>{ongoingActions?.length ?? 0}</strong>
              <span>en activité</span>
            </div>
          </div>
        </div>
      )}
      <div className="farm-workspace">
        <div className="farm-map-area">
          {!parcels ? (
            <div className="map-loading" role="status">
              <Sprout size={36} />
              <span>
                {parcelsError
                  ? "Le serveur de la ferme est indisponible."
                  : "Ouverture de votre exploitation…"}
              </span>
              {parcelsError && (
                <button
                  className="farm-primary-button"
                  onClick={refreshParcels}
                >
                  Réessayer
                </button>
              )}
            </div>
          ) : (
            <FarmMap
              parcels={parcels}
              ongoingActions={ongoingActions ?? []}
              selectedId={selectedId}
              onSelect={loadParcel}
              walletBalance={wallet?.balance_usd}
              weather={calendar?.weather}
            />
          )}
        </div>
        <aside
          ref={inspectorRef}
          className="farm-inspector"
          aria-label="Gestion de l’exploitation"
        >
          {selectedId !== null ? (
            <>
              <div className="inspector-heading">
                <button onClick={closeParcel} className="inspector-back">
                  <ArrowLeft size={15} /> Mon exploitation
                </button>
                <button onClick={closeParcel} aria-label="Fermer la parcelle">
                  <X size={17} />
                </button>
              </div>
              {parcelError ? (
                <div className="parcel-load-error" role="alert">
                  <AlertCircle size={24} />
                  <p>{parcelError}</p>
                  <button
                    className="farm-primary-button"
                    onClick={() => loadParcel(selectedId)}
                  >
                    Réessayer
                  </button>
                </div>
              ) : (
                <ParcelPanel
                  key={selectedId}
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
              )}
            </>
          ) : (
            <>
              <div className="inspector-heading">
                <h2>Mon exploitation</h2>
                <span className="live-badge">EN DIRECT</span>
              </div>
              <div className="farm-welcome">
                <div className="farm-welcome-art">
                  <Sprout size={48} strokeWidth={1.2} />
                  <span className="welcome-orbit" />
                </div>
                <h3>
                  Un peu de terre.
                  <br />
                  Beaucoup de possibilités.
                </h3>
                <p>
                  Explorez votre domaine, prenez soin de vos cultures et
                  regardez votre ferme grandir.
                </p>
                <button
                  className="farm-primary-button"
                  disabled={!owned.length}
                  onClick={() => loadParcel(owned[0].parcel_id)}
                >
                  Gérer ma première parcelle <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="inspector-section">
                <div className="inspector-section-title">
                  <h3>Vos terres</h3>
                  <Link href="/parcels" aria-label="Voir toutes les parcelles">
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
                {Object.entries(SURFACE_LABELS).map(([type, label]) => (
                  <div className="land-summary" key={type}>
                    <span className={`land-dot land-${type}`} />
                    <span>{label}</span>
                    <strong>
                      {owned.filter((p) => p.type_surface === type).length}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="inspector-section">
                <div className="inspector-section-title">
                  <h3>Activités en cours</h3>
                  <span>{ongoingActions?.length ?? 0}</span>
                </div>
                {!ongoingActions?.length ? (
                  <p className="inspector-empty">
                    Tout est calme pour le moment.
                    <br />
                    La prochaine récolte commence avec vous.
                  </p>
                ) : (
                  ongoingActions.map((action) => (
                    <button
                      className="activity-row"
                      key={action.ongoing_action_id}
                      onClick={() => loadParcel(action.parcel_id)}
                    >
                      <div>
                        <strong>Parcelle {action.parcel_id}</strong>
                        <span>
                          {formatDuration(action.remaining_minutes * 60)}
                        </span>
                      </div>
                      <p>{action.action_type}</p>
                      <div className="activity-progress">
                        <i
                          style={{
                            width: `${Math.min(100, Math.max(0, action.progress_percent))}%`,
                          }}
                        />
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="farm-tip">
                <Sprout size={19} />
                <p>
                  Le bon geste, au bon moment.
                  <br />
                  <span>La météo influence la croissance de vos cultures.</span>
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

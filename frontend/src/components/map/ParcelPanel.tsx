"use client";

import { useState } from "react";
import { Sprout, Warehouse, Flame, Wallet } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Select } from "@/components/ui/Select";
import { InfoTip } from "@/components/ui/InfoTip";
import { ResourcePicker } from "@/components/shop/ResourcePicker";
import { ParcelStage } from "@/components/map/ParcelStage";
import type { CatalogItem, OngoingAction, ParcelDetail, PossibleAction, ResourceMode, Weather, Worker } from "@/lib/types";
import { decodeResourceValue, formatDuration, formatUsd, GROWING_NEXT_ACTIONS, SURFACE_LABELS } from "@/lib/utils";

interface ParcelPanelProps {
  parcel: ParcelDetail | null;
  loading: boolean;
  ongoingAction?: OngoingAction;
  workers: Worker[];
  catalog: CatalogItem[];
  weather?: Weather;
  onRefreshCatalog: () => Promise<void>;
  onBuy: () => Promise<{ success: boolean; message: string }>;
  onUpgradeStorage: () => Promise<{ success: boolean; message: string }>;
  onProtect: () => Promise<{ success: boolean; message: string }>;
  onStartAction: (
    actionType: string,
    workerId: number,
    resources: { subcategory: string; item_id: number; mode: ResourceMode }[],
  ) => Promise<{ success: boolean; message: string }>;
}

export function ParcelPanel({
  parcel,
  loading,
  ongoingAction,
  workers,
  catalog,
  weather,
  onRefreshCatalog,
  onBuy,
  onUpgradeStorage,
  onProtect,
  onStartAction,
}: ParcelPanelProps) {
  const [busy, setBusy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [protecting, setProtecting] = useState(false);
  const [protectError, setProtectError] = useState<string | null>(null);

  if (!parcel) {
    return (
      <Card>
        <CardBody className="py-12 text-center text-sm text-foreground-muted">
          Sélectionnez une parcelle sur le plan pour voir ses détails.
        </CardBody>
      </Card>
    );
  }

  async function handleBuy() {
    setBusy(true);
    setBuyError(null);
    try {
      const result = await onBuy();
      if (!result.success) setBuyError(result.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleProtect() {
    setProtecting(true);
    setProtectError(null);
    try {
      const result = await onProtect();
      if (!result.success) setProtectError(result.message);
    } finally {
      setProtecting(false);
    }
  }

  const action = parcel.possible_actions[0];
  const isEntrepot = parcel.type_surface === "entrepôt";
  const isGrowing = parcel.is_purchased && !isEntrepot;
  const isDangerWeather = weather === "gel" || weather === "canicule";
  const isAtRisk =
    isGrowing &&
    !!parcel.parcel_next_action &&
    GROWING_NEXT_ACTIONS.has(parcel.parcel_next_action) &&
    !parcel.protected_today &&
    isDangerWeather;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcelle {parcel.parcel_id}</CardTitle>
        <Badge tone={parcel.is_purchased ? "brand" : "neutral"}>
          {parcel.is_purchased ? "Possédée" : "À vendre"}
        </Badge>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-foreground-muted">Type</dt>
          <dd className="text-right font-medium text-foreground">
            {SURFACE_LABELS[parcel.type_surface] ?? parcel.type_surface}
          </dd>
          <dt className="text-foreground-muted">Superficie</dt>
          <dd className="text-right font-medium text-foreground">{parcel.superficie} ha</dd>
          {!parcel.is_purchased && (
            <>
              <dt className="text-foreground-muted">Prix</dt>
              <dd className="text-right font-medium text-foreground">{formatUsd(parcel.prix)}</dd>
            </>
          )}
          {isGrowing && (
            <>
              {parcel.planted_seed_name && (
                <>
                  <dt className="text-foreground-muted">Variété plantée</dt>
                  <dd className="text-right font-medium text-foreground">{parcel.planted_seed_name}</dd>
                </>
              )}
              <dt className="flex items-center gap-1 text-foreground-muted">
                Santé de la récolte
                <InfoTip text="Diminue de 15 à 25 points chaque jour de gel ou de canicule non protégé — réduit le rendement final de la récolte dans les mêmes proportions." />
              </dt>
              <dd
                className={`text-right font-medium ${parcel.yield_health < 60 ? "text-red-600" : parcel.yield_health < 100 ? "text-amber-600" : "text-foreground"}`}
              >
                {Math.round(parcel.yield_health)}%
              </dd>
              {parcel.fertilized && (
                <>
                  <dt className="flex items-center gap-1 text-foreground-muted">
                    Engrais
                    <InfoTip text="Bonus fixe pour tout ce cycle de culture, acquis en passant l'étape « mettre engrais ». Se cumule avec la santé de la récolte et le rendement propre à la variété plantée." />
                  </dt>
                  <dd className="flex items-center justify-end gap-1 text-right font-medium text-brand-700">
                    <Sprout size={13} /> +25% récolte
                  </dd>
                </>
              )}
            </>
          )}
          {isEntrepot && parcel.is_purchased && (
            <>
              <dt className="text-foreground-muted">Niveau</dt>
              <dd className="text-right font-medium text-foreground">{parcel.storage_level}</dd>
            </>
          )}
        </dl>

        {isGrowing && parcel.growth_progress_percent != null && (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-foreground-muted">
                Pousse
                <InfoTip text="Progression de la culture depuis le semis — la récolte n'est possible qu'à 100%. La pluie accélère la pousse, la canicule la ralentit." />
              </span>
              <span className="font-medium text-foreground">
                {Math.round(parcel.growth_progress_percent)}%
              </span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={parcel.growth_progress_percent} />
            </div>
          </div>
        )}

        {isAtRisk && (
          <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">
              {weather === "gel"
                ? "Risque de gel aujourd'hui — protégez cette parcelle pour annuler les dégâts."
                : "Canicule aujourd'hui — protégez cette parcelle pour limiter le stress thermique."}
            </p>
            <Button size="sm" variant="danger" disabled={protecting} onClick={handleProtect}>
              <Flame size={13} className="mr-1.5" />
              Protéger la parcelle
            </Button>
            {protectError && <p className="text-xs text-red-700">{protectError}</p>}
          </div>
        )}

        {!parcel.is_purchased ? (
          <div className="flex flex-col gap-2">
            <Button onClick={handleBuy} disabled={busy || loading}>
              Acheter la parcelle
            </Button>
            {buyError && <p className="text-xs text-red-600">{buyError}</p>}
          </div>
        ) : isEntrepot ? (
          <StorageUpgradePanel parcel={parcel} onUpgradeStorage={onUpgradeStorage} />
        ) : ongoingAction ? (
          <div className="flex flex-col gap-3">
            <ParcelStage parcelId={parcel.parcel_id} actionType={ongoingAction.action_type} />
            <div className="rounded-lg border border-border bg-surface-sunken p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{ongoingAction.action_type}</span>
                <span className="text-foreground-muted">
                  {formatDuration(ongoingAction.remaining_minutes * 60)}
                </span>
              </div>
              <p className="mt-1 text-xs text-foreground-muted">Ouvrier : {ongoingAction.worker_name}</p>
              <div className="mt-2">
                <ProgressBar value={ongoingAction.progress_percent} className="animate-soft-pulse" />
              </div>
            </div>
          </div>
        ) : !action ? (
          <p className="text-sm text-foreground-muted">Aucune action disponible.</p>
        ) : (
          <ActionForm
            key={parcel.parcel_id}
            action={action}
            superficie={parcel.superficie}
            workers={workers}
            catalog={catalog}
            onRefreshCatalog={onRefreshCatalog}
            onStartAction={onStartAction}
          />
        )}
      </CardBody>
    </Card>
  );
}

function StorageUpgradePanel({
  parcel,
  onUpgradeStorage,
}: {
  parcel: ParcelDetail;
  onUpgradeStorage: () => Promise<{ success: boolean; message: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setBusy(true);
    setError(null);
    try {
      const result = await onUpgradeStorage();
      if (!result.success) setError(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border bg-surface-sunken p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Warehouse size={15} className="text-brand-700" />
          Entrepôt niveau {parcel.storage_level}
          <InfoTip text="La capacité ajoutée dépend du niveau de l'entrepôt, pas de sa superficie sur la carte. Chaque entrepôt possédé s'additionne à la capacité totale de stockage affichée dans la navbar." />
        </div>
        <p className="mt-1 text-xs text-foreground-muted">
          Chaque niveau augmente la capacité de stockage globale de votre exploitation.
        </p>
      </div>
      <Button size="sm" onClick={handleUpgrade} disabled={busy}>
        Améliorer au niveau {parcel.storage_level + 1}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ActionForm({
  action,
  superficie,
  workers,
  catalog,
  onRefreshCatalog,
  onStartAction,
}: {
  action: PossibleAction;
  superficie: number;
  workers: Worker[];
  catalog: CatalogItem[];
  onRefreshCatalog: () => Promise<void>;
  onStartAction: ParcelPanelProps["onStartAction"];
}) {
  const [busy, setBusy] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string>("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const availableWorkers = workers.filter((w) => w.available);
  const worker = availableWorkers.find((w) => w.worker_id === Number(selectedWorker));
  const totalMinutes = action.action_time_minutes * superficie;
  const workerCost = worker ? worker.worker_price * totalMinutes : 0;

  const rentalCost = action.requirements.reduce((sum, req) => {
    const decoded = decodeResourceValue(selections[req.subcategory]);
    if (decoded?.mode !== "rent") return sum;
    const item = catalog.find((i) => i.item_id === decoded.itemId);
    return sum + (item?.rental_price ?? 0);
  }, 0);
  const totalCost = workerCost + rentalCost;

  async function handleStart() {
    if (!selectedWorker) return;
    const resources = action.requirements.map((req) => {
      const decoded = decodeResourceValue(selections[req.subcategory]);
      return { subcategory: req.subcategory, item_id: decoded?.itemId ?? 0, mode: decoded?.mode ?? "own" };
    });
    if (resources.some((r) => !r.item_id)) {
      setError("Sélectionnez un article pour chaque ressource requise.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onStartAction(action.action_type, Number(selectedWorker), resources);
      if (!result.success) setError(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium capitalize text-foreground">{action.action_type}</span>
          <span className="text-foreground-muted">{action.action_time_minutes} min/ha</span>
        </div>
        <p className="mt-1 text-xs text-foreground-muted">
          {superficie} ha — {Math.round(totalMinutes)} min au total
        </p>
      </div>

      <label className="text-sm font-medium text-foreground-secondary">
        Ouvrier assigné
        <Select
          value={selectedWorker}
          onChange={(e) => setSelectedWorker(e.target.value)}
          className="mt-1.5"
        >
          <option value="">Choisir un ouvrier</option>
          {availableWorkers.map((w) => (
            <option key={w.worker_id} value={w.worker_id}>
              {w.worker_name} — {formatUsd(w.worker_price)}/h
            </option>
          ))}
        </Select>
      </label>

      {action.requirements.map((req) => (
        <ResourcePicker
          key={req.subcategory}
          subcategory={req.subcategory}
          amountLabel={`x${req.amount}`}
          requiredAmount={req.amount}
          catalog={catalog}
          value={selections[req.subcategory] ?? ""}
          onChange={(value) => setSelections((cur) => ({ ...cur, [req.subcategory]: value }))}
          onRefreshCatalog={onRefreshCatalog}
        />
      ))}

      <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm text-foreground-secondary">
          <Wallet size={15} />
          Coût total
          <InfoTip text="Main d'œuvre (tarif horaire de l'ouvrier × durée) + location éventuelle du matériel. Le matériel possédé n'ajoute rien ici, seul son achat initial coûte." />
        </span>
        <span className="text-lg font-semibold text-foreground">{formatUsd(totalCost)}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button disabled={busy || !selectedWorker} onClick={handleStart}>
        Démarrer
      </Button>
    </div>
  );
}

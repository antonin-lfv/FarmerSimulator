"use client";

import { LandPlot, Timer, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LinkButton } from "@/components/ui/Button";
import { FarmManager } from "@/components/map/FarmManager";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import { formatUsd, formatDuration, SURFACE_LABELS } from "@/lib/utils";

export default function DashboardPage() {
  const { data: parcels } = usePolledData(() => api.getParcels(), 8000);
  const { data: ongoingActions } = usePolledData(() => api.getOngoingActions(), 2000);
  const { data: marketPrices } = usePolledData(() => api.getMarketPrices(), 15000);

  const ownedParcels = parcels?.filter((p) => p.is_purchased).length ?? 0;
  const totalParcels = parcels?.length ?? 0;

  return (
    <div className="mx-auto flex max-w-[104rem] flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Vue d&apos;ensemble de votre exploitation.
        </p>
      </div>

      <FarmManager compact />

      <div className="grid max-w-xl grid-cols-2 gap-4">
        <StatCard
          label="Parcelles possédées"
          value={parcels ? `${ownedParcels} / ${totalParcels}` : "…"}
          icon={LandPlot}
          infoTip="Nombre de parcelles achetées sur le total disponible sur la carte, tous types confondus (champs, forêts, vignes, entrepôts)."
        />
        <StatCard
          label="Actions en cours"
          value={ongoingActions ? String(ongoingActions.length) : "…"}
          icon={Timer}
          infoTip="Une action par ouvrier assigné à la fois — le nombre maximum d'actions simultanées est donc limité par votre nombre d'ouvriers, pas par le nombre de parcelles."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activités en cours</CardTitle>
        </CardHeader>
        <CardBody>
          {!ongoingActions || ongoingActions.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground-muted">
              Aucune activité en cours pour le moment.
            </p>
          ) : (
            <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {ongoingActions.map((action) => (
                <li key={action.ongoing_action_id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      Parcelle {action.parcel_id} — {action.action_type}
                    </span>
                    <span className="text-foreground-muted">
                      {formatDuration(action.remaining_minutes * 60)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={action.progress_percent} className="animate-soft-pulse" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            Marché express
            <InfoTip text="Prix du jour pour chaque récolte — recalculés une fois par jour de jeu, avec de petites fluctuations aléatoires autour d'une moyenne propre à chaque produit." />
          </CardTitle>
          <LinkButton href="/market" variant="ghost" size="sm">
            <TrendingUp size={14} className="mr-1" />
            Marché
          </LinkButton>
        </CardHeader>
        <CardBody>
          {!marketPrices || marketPrices.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground-muted">Chargement du marché…</p>
          ) : (
            <ul className="grid gap-x-8 divide-y divide-border sm:grid-cols-2 lg:grid-cols-3">
              {marketPrices.slice(0, 6).map((price) => (
                <li
                  key={`${price.category}-${price.subcategory}`}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="capitalize text-foreground-secondary">
                    {price.subcategory}
                  </span>
                  <span className="font-medium text-foreground">{formatUsd(price.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground-secondary">Types de surface</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Object.entries(SURFACE_LABELS).map(([key, label]) => {
            const count = parcels?.filter((p) => p.type_surface === key && p.is_purchased).length ?? 0;
            const total = parcels?.filter((p) => p.type_surface === key).length ?? 0;
            return (
              <Card key={key} className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {count} / {total}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

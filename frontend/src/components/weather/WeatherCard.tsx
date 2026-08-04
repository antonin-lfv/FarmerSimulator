"use client";

import { useState } from "react";
import { Sun, CloudRain, Snowflake, Flame, TriangleAlert } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { usePolledData } from "@/lib/hooks";
import { useCalendar } from "@/lib/calendar-context";
import { api } from "@/lib/api";
import type { Weather } from "@/lib/types";
import { cn, GROWING_NEXT_ACTIONS, SURFACE_LABELS } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";

const SEASON_LABELS: Record<string, string> = {
  hiver: "Hiver",
  printemps: "Printemps",
  été: "Été",
  automne: "Automne",
};

const WEATHER_ICONS: Record<Weather, typeof Sun> = {
  normal: Sun,
  pluie: CloudRain,
  gel: Snowflake,
  canicule: Flame,
};

const SKY_GRADIENT = "linear-gradient(160deg, #5b9fdb 0%, #7fb8e6 55%, #a6cdec 100%)";

const WEATHER_ICON_COLORS: Record<Weather, string> = {
  normal: "text-amber-300",
  pluie: "text-slate-50",
  gel: "text-cyan-100",
  canicule: "text-orange-200",
};

const WEATHER_ICON_COLORS_ON_WHITE: Record<Weather, string> = {
  normal: "text-amber-500",
  pluie: "text-blue-600",
  gel: "text-cyan-600",
  canicule: "text-orange-600",
};

const WEATHER_ICON_ANIM: Record<Weather, string> = {
  normal: "",
  pluie: "animate-soft-pulse",
  gel: "animate-frost-shimmer",
  canicule: "animate-heat-shimmer",
};

export function WeatherCard() {
  const { calendar: today } = useCalendar();
  const { data: forecast } = usePolledData(() => api.getForecast(6), 15000);
  const { data: parcels, refresh: refreshParcels } = usePolledData(() => api.getParcels(), 8000);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [protectingAll, setProtectingAll] = useState(false);
  const push = useToast();

  const TodayIcon = today ? WEATHER_ICONS[today.weather] : Sun;
  const isDanger = today?.weather === "gel" || today?.weather === "canicule";

  const atRiskParcels = (parcels ?? []).filter(
    (p) =>
      p.is_purchased &&
      p.type_surface !== "entrepôt" &&
      p.parcel_next_action &&
      GROWING_NEXT_ACTIONS.has(p.parcel_next_action) &&
      !p.protected_today,
  );

  async function handleProtect(parcelId: number) {
    setBusyId(parcelId);
    try {
      const result = await api.protectParcel(parcelId);
      if (result.success) {
        push({ tone: "success", title: `Parcelle ${parcelId} protégée`, description: result.message });
        await refreshParcels();
      } else {
        push({ tone: "error", title: "Protection impossible", description: result.message });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleProtectAll() {
    setProtectingAll(true);
    try {
      const result = await api.bulkProtect();
      push({
        tone: result.protected > 0 ? "success" : "error",
        title: "Protection groupée",
        description: result.message,
      });
      await refreshParcels();
    } finally {
      setProtectingAll(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative flex flex-col overflow-hidden p-5" style={{ background: SKY_GRADIENT }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -left-8 top-1 h-16 w-36 rounded-full bg-white/60 blur-xl animate-cloud-drift-slow" />
          <span className="absolute right-[-10%] top-6 h-12 w-28 rounded-full bg-white/50 blur-lg animate-cloud-drift" />
          <span
            className="absolute left-[35%] -bottom-6 h-14 w-32 rounded-full bg-white/45 blur-xl animate-cloud-drift-slow"
            style={{ animationDelay: "-9s" }}
          />
          <span
            className="absolute right-[15%] -bottom-3 h-10 w-24 rounded-full bg-white/35 blur-lg animate-cloud-drift"
            style={{ animationDelay: "-4s" }}
          />
        </div>

        <div className="relative flex items-center justify-between">
          <span className="text-base font-semibold text-white/95">Météo & saisons</span>
          {today && (
            <span className="text-sm text-white/75">{SEASON_LABELS[today.season] ?? today.season}</span>
          )}
        </div>

        {!today ? (
          <p className="relative py-4 text-center text-sm text-white/80">Chargement…</p>
        ) : (
          <>
            <div className="relative mt-3 flex items-center gap-3">
              <span className={cn("drop-shadow-md", WEATHER_ICON_COLORS[today.weather], WEATHER_ICON_ANIM[today.weather])}>
                <TodayIcon size={44} strokeWidth={1.6} />
              </span>
              <div>
                <p className="text-xl font-semibold text-white drop-shadow-sm">{today.weather_label}</p>
                <p className="text-sm text-white/75">
                  {today.day_of_month} {today.month_name}
                </p>
              </div>
              {today.weather === "pluie" && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-sm font-medium text-foreground/80">
                  Actions ×{today.growth_multiplier.toFixed(2)}
                  <InfoTip text="La pluie accélère la pousse des cultures en terre ce jour-ci — la récolte sera prête plus tôt qu'en temps normal." />
                </span>
              )}
            </div>

            {forecast && forecast.length > 1 && (
              <div className="relative mt-4 flex gap-2">
                {forecast.slice(1).map((day) => {
                  const Icon = WEATHER_ICONS[day.weather];
                  return (
                    <div
                      key={day.day_index}
                      className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-white/80 py-2.5"
                    >
                      <span className="text-xs text-foreground/60">{day.day_of_month}</span>
                      <Icon size={18} className={WEATHER_ICON_COLORS_ON_WHITE[day.weather]} />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {isDanger && (
        <CardBody className="border-t border-border">
          <div className="flex items-start gap-2 text-sm">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">
                  {today?.weather === "gel" ? "Alerte gel" : "Alerte canicule"}
                </p>
                {atRiskParcels.length > 1 && (
                  <Button size="sm" variant="danger" disabled={protectingAll} onClick={handleProtectAll}>
                    Protéger toutes ({atRiskParcels.length})
                  </Button>
                )}
              </div>
              <p className="text-sm text-foreground-muted">
                {today?.weather === "gel"
                  ? "Allumez des feux dans les vignes et champs exposés pour protéger la récolte."
                  : "Arrosez les parcelles exposées pour limiter le stress thermique."}
              </p>
            </div>
          </div>

          {atRiskParcels.length > 0 ? (
            <>
              <ul className="mt-3 flex flex-col gap-1.5">
                {atRiskParcels.slice(0, 4).map((parcel) => (
                  <li
                    key={parcel.parcel_id}
                    className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-1.5 text-xs"
                  >
                    <span className="text-foreground-secondary">
                      Parcelle {parcel.parcel_id} — {SURFACE_LABELS[parcel.type_surface]}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === parcel.parcel_id}
                      onClick={() => handleProtect(parcel.parcel_id)}
                    >
                      Protéger
                    </Button>
                  </li>
                ))}
              </ul>
              {atRiskParcels.length > 4 && (
                <p className="mt-1.5 text-xs text-foreground-muted">
                  + {atRiskParcels.length - 4} autre{atRiskParcels.length - 4 > 1 ? "s" : ""} parcelle
                  {atRiskParcels.length - 4 > 1 ? "s" : ""} exposée{atRiskParcels.length - 4 > 1 ? "s" : ""} —
                  utilisez « Protéger toutes ».
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-xs text-foreground-muted">
              Aucune parcelle exposée pour le moment.
            </p>
          )}
        </CardBody>
      )}
    </Card>
  );
}

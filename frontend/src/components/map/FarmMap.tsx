"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CloudRain, Snowflake, Flame, TriangleAlert } from "lucide-react";
import { MAP_VIEWBOX, PARCEL_PATHS } from "@/data/parcelPaths";
import type { OngoingAction, Parcel, Weather } from "@/lib/types";
import { GROWING_NEXT_ACTIONS, SURFACE_COLORS, SURFACE_LABELS, formatDuration, formatUsd } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ActionIcon } from "@/components/map/ActionIcon";

const WEATHER_OVERLAY_INFO: Partial<Record<Weather, { icon: typeof CloudRain; label: string; tone: string }>> = {
  pluie: { icon: CloudRain, label: "Pluie — pousse accélérée (×1.1)", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  gel: { icon: Snowflake, label: "Gel — risque de dégâts sur les cultures non protégées", tone: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  canicule: { icon: Flame, label: "Canicule — risque de dégâts sur les cultures non protégées", tone: "bg-orange-50 text-orange-800 border-orange-200" },
};

interface FarmMapProps {
  parcels: Parcel[];
  ongoingActions: OngoingAction[];
  selectedId: number | null;
  onSelect: (parcelId: number) => void;
  walletBalance?: number;
  showLegend?: boolean;
  weather?: Weather;
}

const TOOLTIP_WIDTH = 232;

export function FarmMap({
  parcels,
  ongoingActions,
  selectedId,
  onSelect,
  walletBalance,
  showLegend = true,
  weather,
}: FarmMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<Map<number, SVGPathElement>>(new Map());
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, containerWidth: 0 });
  const [centroids, setCentroids] = useState<Map<number, { x: number; y: number }>>(new Map());

  const parcelById = new Map(parcels.map((p) => [p.parcel_id, p]));
  const actionByParcel = new Map(ongoingActions.map((a) => [a.parcel_id, a]));
  const hovered = hoveredId != null ? parcelById.get(hoveredId) : undefined;
  const hoveredAction = hoveredId != null ? actionByParcel.get(hoveredId) : undefined;

  useEffect(() => {
    // getBBox() returns coordinates in the SVG's own user space, not screen
    // pixels — stable regardless of container size, so every parcel's centroid
    // only needs computing once, right after the paths first paint.
    const next = new Map<number, { x: number; y: number }>();
    for (const { parcelId } of PARCEL_PATHS) {
      const el = pathRefs.current.get(parcelId);
      if (el) {
        const box = el.getBBox();
        next.set(parcelId, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- getBBox() needs the paths mounted/painted first, can't compute during render
    setCentroids(next);
  }, []);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, containerWidth: rect.width });
  }

  function isAffordable(parcel: Parcel) {
    return walletBalance != null && parcel.prix <= walletBalance;
  }

  function fillFor(parcel: Parcel | undefined, isHovered: boolean, isSelected: boolean) {
    if (!parcel) return "rgba(120,120,110,0.25)";
    if (!parcel.is_purchased) {
      if (isAffordable(parcel)) {
        return isHovered ? "rgba(59,146,71,0.45)" : "rgba(59,146,71,0.28)";
      }
      return isHovered ? "rgba(11,11,11,0.28)" : "rgba(11,11,11,0.14)";
    }
    const base = SURFACE_COLORS[parcel.type_surface] ?? "#3b9247";
    const opacity = isSelected ? 0.88 : isHovered ? 0.8 : 0.62;
    return hexToRgba(base, opacity);
  }

  function strokeFor(parcel: Parcel | undefined, isHovered: boolean, isSelected: boolean, hasAction: boolean) {
    if (isSelected) return "#193e20";
    if (parcel?.is_purchased) return isHovered ? "#193e20" : "#2c7838";
    if (isHovered) return "#2c7838";
    if (hasAction) return "#3b9247";
    return "transparent";
  }

  const onRightHalf = tooltipPos.x > tooltipPos.containerWidth / 2;
  const tooltipLeft = onRightHalf
    ? Math.max(tooltipPos.x - TOOLTIP_WIDTH - 28, 8)
    : Math.min(tooltipPos.x + 28, (tooltipPos.containerWidth || 999) - TOOLTIP_WIDTH - 8);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="relative w-full select-none overflow-hidden rounded-xl border border-border bg-surface"
        onMouseMove={handleMouseMove}
      >
        <svg viewBox={MAP_VIEWBOX} className="h-full w-full">
          <image href="/map/map.png" x="0" y="0" width="1097.3333" height="1096" preserveAspectRatio="xMidYMid slice" />
          {PARCEL_PATHS.map(({ parcelId, d }) => {
            const parcel = parcelById.get(parcelId);
            const isHovered = hoveredId === parcelId;
            const isSelected = selectedId === parcelId;
            const action = actionByParcel.get(parcelId);
            return (
              <path
                key={parcelId}
                ref={(el) => {
                  if (el) pathRefs.current.set(parcelId, el);
                }}
                d={d}
                fill={fillFor(parcel, isHovered, isSelected)}
                stroke={strokeFor(parcel, isHovered, isSelected, Boolean(action))}
                strokeWidth={isSelected ? 3 : parcel?.is_purchased || isHovered ? 2 : action ? 1.5 : 0}
                className="cursor-pointer transition-[fill,stroke] duration-150"
                onMouseEnter={() => setHoveredId(parcelId)}
                onMouseLeave={() => setHoveredId((cur) => (cur === parcelId ? null : cur))}
                onClick={() => onSelect(parcelId)}
              />
            );
          })}

          {ongoingActions.map((action) => {
            const centroid = centroids.get(action.parcel_id);
            if (!centroid) return null;
            return (
              <g
                key={action.ongoing_action_id}
                transform={`translate(${centroid.x}, ${centroid.y})`}
                className="pointer-events-none animate-bounce-icon"
              >
                <circle r={22} fill="white" stroke="#2c7838" strokeWidth={2} />
                <svg x={-13} y={-13} width={26} height={26} viewBox="0 0 24 24">
                  <ActionIcon actionType={action.action_type} size={26} className="text-brand-700" strokeWidth={2.4} />
                </svg>
              </g>
            );
          })}

          {parcels.map((parcel) => {
            if (!parcel.is_purchased || parcel.type_surface === "entrepôt") return null;
            if (actionByParcel.has(parcel.parcel_id)) return null; // busy icon already covers this
            const centroid = centroids.get(parcel.parcel_id);
            if (!centroid || !parcel.parcel_next_action) return null;

            const atRisk =
              (weather === "gel" || weather === "canicule") &&
              GROWING_NEXT_ACTIONS.has(parcel.parcel_next_action) &&
              !parcel.protected_today;

            if (atRisk) {
              return (
                <g
                  key={`status-${parcel.parcel_id}`}
                  transform={`translate(${centroid.x}, ${centroid.y})`}
                  className="pointer-events-none"
                >
                  <circle r={14} fill="white" stroke="#dc2626" strokeWidth={2} className="animate-soft-pulse" />
                  <svg x={-9} y={-9} width={18} height={18} viewBox="0 0 24 24">
                    <TriangleAlert size={18} className="text-red-600" strokeWidth={2.4} />
                  </svg>
                </g>
              );
            }

            return (
              <g
                key={`status-${parcel.parcel_id}`}
                transform={`translate(${centroid.x}, ${centroid.y})`}
                className="pointer-events-none"
              >
                <circle r={14} fill="white" stroke="#2c7838" strokeWidth={2} />
                <svg x={-9} y={-9} width={18} height={18} viewBox="0 0 24 24">
                  <ActionIcon actionType={parcel.parcel_next_action} size={18} className="text-brand-700" strokeWidth={2.4} />
                </svg>
              </g>
            );
          })}
        </svg>

        {weather && WEATHER_OVERLAY_INFO[weather] && (
          <div
            className={`pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${WEATHER_OVERLAY_INFO[weather]!.tone}`}
          >
            <WeatherOverlayIcon weather={weather} />
            <span className="truncate">{WEATHER_OVERLAY_INFO[weather]!.label}</span>
          </div>
        )}

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-border bg-white/95 p-3 shadow-lg backdrop-blur-sm"
            style={{
              width: TOOLTIP_WIDTH,
              left: tooltipLeft,
              top: Math.max(tooltipPos.y - 12, 8),
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">Parcelle {hovered.parcel_id}</span>
              <span className="text-xs font-medium capitalize text-foreground-secondary">
                {SURFACE_LABELS[hovered.type_surface] ?? hovered.type_surface}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">{hovered.superficie} ha</p>

            {!hovered.is_purchased ? (
              <p
                className={`mt-1.5 text-sm font-medium ${isAffordable(hovered) ? "text-brand-700" : "text-foreground-muted"}`}
              >
                {formatUsd(hovered.prix)} {isAffordable(hovered) ? "— accessible" : "— trop cher"}
              </p>
            ) : hoveredAction ? (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{hoveredAction.action_type}</span>
                  <span className="text-foreground-muted">
                    {formatDuration(hoveredAction.remaining_minutes * 60)}
                  </span>
                </div>
                <div className="mt-1">
                  <ProgressBar value={hoveredAction.progress_percent} />
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-foreground-secondary">
                Suivant : <span className="font-medium">{hovered.parcel_next_action ?? "—"}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-foreground-secondary">
          <LegendSwatch color="rgba(59,146,71,0.45)" border="#3b9247" label="À vendre — accessible" />
          <LegendSwatch color="rgba(11,11,11,0.16)" border="#c3c2b7" label="À vendre — trop cher" />
          <LegendSwatch color={SURFACE_COLORS.champ} label="Possédée" />
          <span className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-brand-700 bg-white" />
            Action à lancer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-brand-700 bg-brand-600" />
            Action en cours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-red-600 bg-white">
              <TriangleAlert size={8} className="text-red-600" />
            </span>
            Parcelle à risque
          </span>
        </div>
      )}
    </div>
  );
}

function WeatherOverlayIcon({ weather }: { weather: Weather }) {
  const info = WEATHER_OVERLAY_INFO[weather];
  if (!info) return null;
  // eslint-disable-next-line react-hooks/static-components -- icons are stateless Lucide components, contained here like ActionIcon.tsx
  const Icon = info.icon;
  return <Icon size={15} className="shrink-0" />;
}

function LegendSwatch({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-sm"
        style={{ backgroundColor: color, border: border ? `1.5px solid ${border}` : undefined }}
      />
      {label}
    </span>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

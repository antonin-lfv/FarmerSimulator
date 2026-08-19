"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CloudRain, Snowflake, Flame, TriangleAlert, Sun } from "lucide-react";
import { MAP_VIEWBOX, PARCEL_PATHS } from "@/data/parcelPaths";
import { WATER_REGIONS } from "@/data/mapDecor";
import type { OngoingAction, Parcel, Weather } from "@/lib/types";
import { isParcelAtRisk, SURFACE_LABELS, formatDuration, formatUsd } from "@/lib/utils";
import { useClickOutside } from "@/lib/hooks";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ActionIcon } from "@/components/map/ActionIcon";

const [VB_X, VB_Y, VB_W, VB_H] = MAP_VIEWBOX.split(" ").map(Number);

const WEATHER_OVERLAY_INFO: Record<Weather, { icon: typeof CloudRain; label: string; tone: string }> = {
  normal: { icon: Sun, label: "Ensoleillé", tone: "bg-amber-50 text-amber-800 border-amber-200" },
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
  // The floating info bubble only appears on click now (not on hover) — see
  // the path's onClick below. tooltipId is intentionally separate from
  // hoveredId, which still drives the plain fill/stroke hover highlight.
  const [tooltipId, setTooltipId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, containerWidth: 0 });
  const [centroids, setCentroids] = useState<Map<number, { x: number; y: number }>>(new Map());

  const parcelById = new Map(parcels.map((p) => [p.parcel_id, p]));
  const actionByParcel = new Map(ongoingActions.map((a) => [a.parcel_id, a]));
  const tooltipParcel = tooltipId != null ? parcelById.get(tooltipId) : undefined;
  const tooltipAction = tooltipId != null ? actionByParcel.get(tooltipId) : undefined;

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

  useClickOutside(containerRef, () => setTooltipId(null));

  function handleParcelClick(e: MouseEvent<SVGPathElement>, parcelId: number) {
    onSelect(parcelId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, containerWidth: rect.width });
    }
    setTooltipId((cur) => (cur === parcelId ? null : parcelId));
  }

  function isAffordable(parcel: Parcel) {
    return walletBalance != null && parcel.prix <= walletBalance;
  }

  function fillFor(parcel: Parcel | undefined, isHovered: boolean, isSelected: boolean) {
    if (!parcel) return "rgba(120,120,110,0.25)";
    // For-sale parcels: flat grey hatch + a padlock marker (see the lock overlay
    // below) instead of a color-coded tint — affordability now lives entirely on
    // the padlock's color, not the fill.
    if (!parcel.is_purchased) return "url(#forsale-hatch)";
    // Purchased parcels get no fill at all at rest — the real map image shows
    // through untinted; only hover/selection add a light wash so the parcel
    // stays identifiable while interacting.
    if (isSelected) return "rgba(59,146,71,0.3)";
    if (isHovered) return "rgba(59,146,71,0.16)";
    return "transparent";
  }

  function strokeFor(parcel: Parcel | undefined, isHovered: boolean, isSelected: boolean, hasAction: boolean) {
    if (isSelected) return "#193e20";
    if (!parcel?.is_purchased) return isHovered ? "#5b5b50" : "rgba(80,80,72,0.45)";
    if (isHovered) return "#193e20";
    if (hasAction) return "#3b9247";
    return "rgba(25,62,32,0.35)";
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
      >
        <svg viewBox={MAP_VIEWBOX} className="h-full w-full">
          <defs>
            {/* Grey diagonal hatch for unpurchased parcels — replaces the old flat
                affordability-tinted fill, see fillFor(). */}
            <pattern id="forsale-hatch" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)">
              <rect width="9" height="9" fill="rgba(130,130,120,0.5)" />
              <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(70,70,64,0.55)" strokeWidth="3.5" />
            </pattern>
            {/* Soft blurred highlights that drift across any water shape they're
                clipped to — a cheap "light on water" shimmer, no per-shape tuning
                needed since each ellipse is oversized and just cropped by the clip. */}
            <filter id="water-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="20" />
            </filter>
            {WATER_REGIONS.map((region) => (
              <clipPath key={region.id} id={`water-clip-${region.id}`}>
                <path d={region.d} />
              </clipPath>
            ))}
          </defs>

          <image href="/map/map.png" x="0" y="0" width="1097.3333" height="1096" preserveAspectRatio="xMidYMid slice" />

          {/* Water shimmer — purely decorative, never intercepts clicks. Plain
              CSS animation (globals.css: animate-water-drift), not SMIL — see
              the comment there for why. */}
          <g className="pointer-events-none">
            {WATER_REGIONS.map((region) => (
              <g key={region.id} clipPath={`url(#water-clip-${region.id})`}>
                <ellipse
                  className="animate-water-drift"
                  cx={region.shimmer.cx}
                  cy={region.shimmer.cy}
                  rx={region.shimmer.rx * 0.5}
                  ry={region.shimmer.ry * 0.5}
                  fill="white"
                  opacity={0.35}
                  filter="url(#water-blur)"
                />
                <ellipse
                  className="animate-water-drift-alt"
                  cx={region.shimmer.cx - region.shimmer.rx * 0.5}
                  cy={region.shimmer.cy}
                  rx={region.shimmer.rx * 0.35}
                  ry={region.shimmer.ry * 0.5}
                  fill="white"
                  opacity={0.25}
                  filter="url(#water-blur)"
                />
              </g>
            ))}
          </g>

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
                strokeWidth={!parcel ? 0 : isSelected ? 3 : isHovered ? 2 : parcel.is_purchased ? 1.5 : 1}
                className="cursor-pointer transition-[fill,stroke] duration-150"
                onMouseEnter={() => setHoveredId(parcelId)}
                onMouseLeave={() => setHoveredId((cur) => (cur === parcelId ? null : cur))}
                onClick={(e) => handleParcelClick(e, parcelId)}
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

            const atRisk = isParcelAtRisk(parcel, weather);

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

        {tooltipParcel && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-border bg-white/95 p-3 shadow-lg backdrop-blur-sm"
            style={{
              width: TOOLTIP_WIDTH,
              left: tooltipLeft,
              top: Math.max(tooltipPos.y - 12, 8),
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">Parcelle {tooltipParcel.parcel_id}</span>
              <span className="text-xs font-medium capitalize text-foreground-secondary">
                {SURFACE_LABELS[tooltipParcel.type_surface] ?? tooltipParcel.type_surface}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-foreground-muted">{tooltipParcel.superficie} ha</p>

            {!tooltipParcel.is_purchased ? (
              <p
                className={`mt-1.5 text-sm font-medium ${isAffordable(tooltipParcel) ? "text-brand-700" : "text-foreground-muted"}`}
              >
                {formatUsd(tooltipParcel.prix)} {isAffordable(tooltipParcel) ? "— accessible" : "— trop cher"}
              </p>
            ) : tooltipAction ? (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{tooltipAction.action_type}</span>
                  <span className="text-foreground-muted">
                    {formatDuration(tooltipAction.remaining_minutes * 60)}
                  </span>
                </div>
                <div className="mt-1">
                  <ProgressBar value={tooltipAction.progress_percent} />
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-foreground-secondary">
                Suivant : <span className="font-medium">{tooltipParcel.parcel_next_action ?? "—"}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-foreground-secondary">
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm border border-[#4a4a42]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(70,70,64,0.55) 0 1.5px, rgba(130,130,120,0.5) 1.5px 4px)",
              }}
            />
            À vendre
          </span>
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


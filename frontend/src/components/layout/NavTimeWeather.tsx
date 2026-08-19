"use client";

import { Sun, CloudRain, Snowflake, Flame, AlertTriangle, Leaf, CloudSnow, Sprout } from "lucide-react";
import { useCalendar } from "@/lib/calendar-context";
import type { Weather } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEATHER_ICONS: Record<Weather, typeof Sun> = {
  normal: Sun,
  pluie: CloudRain,
  gel: Snowflake,
  canicule: Flame,
};

const WEATHER_ICON_COLORS: Record<Weather, string> = {
  normal: "text-amber-500",
  pluie: "text-blue-600",
  gel: "text-cyan-600",
  canicule: "text-orange-600",
};

const SEASON_ICONS: Record<string, typeof Leaf> = {
  hiver: CloudSnow,
  printemps: Sprout,
  été: Sun,
  automne: Leaf,
};

// Frost and heatwave are both "danger" states but visually distinct — gel
// reads as cold/blue, canicule stays red, so the two don't look like the
// same kind of alert.
const DANGER_TONE: Partial<Record<Weather, { wrap: string; icon: string; text: string }>> = {
  gel: { wrap: "border-blue-300 bg-blue-50 text-blue-900", icon: "text-blue-700", text: "text-blue-800" },
  canicule: { wrap: "border-red-300 bg-red-50 text-red-800", icon: "text-red-600", text: "text-red-700" },
};

function formatClock(elapsedSeconds: number, dayDuration: number) {
  if (dayDuration <= 0) return "--:--:--";
  const fraction = Math.max(0, elapsedSeconds / dayDuration);
  // Wrap at midnight (86400) instead of clamping to it — the client-side
  // ticker can briefly overrun the real day boundary between two polls.
  const virtualSeconds = Math.floor(fraction * 86400) % 86400;
  const h = Math.floor(virtualSeconds / 3600);
  const m = Math.floor((virtualSeconds % 3600) / 60);
  const s = virtualSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function NavTimeWeather() {
  const { calendar, elapsed } = useCalendar();

  if (!calendar) {
    return (
      <div className="flex h-11 w-52 items-center rounded-full bg-white/10 px-4 text-sm text-white/50">
        Chargement…
      </div>
    );
  }

  const danger = DANGER_TONE[calendar.weather];
  const WeatherIcon = WEATHER_ICONS[calendar.weather];
  const SeasonIcon = SEASON_ICONS[calendar.season] ?? Leaf;

  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center gap-3 rounded-full border px-4 text-sm font-medium",
        danger ? `${danger.wrap} animate-soft-pulse` : "border-transparent bg-white text-foreground-secondary shadow-sm",
      )}
      title={danger ? `Alerte ${calendar.weather_label.toLowerCase()} — risque pour les cultures exposées` : undefined}
    >
      {danger && <AlertTriangle size={16} className={cn("shrink-0", danger.icon)} />}

      <span className="flex items-center gap-1.5">
        <SeasonIcon size={15} className={danger ? danger.icon : "text-brand-600"} />
        {calendar.day_of_month} {calendar.month_name}
      </span>

      <span className="h-4 w-px shrink-0 bg-current opacity-20" />

      <span className="flex items-center gap-1.5">
        <WeatherIcon size={16} className={danger ? danger.icon : WEATHER_ICON_COLORS[calendar.weather]} />
        <span>{calendar.weather_label}</span>
      </span>

      <span className="h-4 w-px shrink-0 bg-current opacity-20" />

      <span
        className={cn("font-mono tabular-nums", danger ? danger.text : "text-foreground-muted")}
        title="Heure du jour"
      >
        {elapsed != null ? formatClock(elapsed, calendar.day_duration_seconds) : "--:--:--"}
      </span>
    </div>
  );
}

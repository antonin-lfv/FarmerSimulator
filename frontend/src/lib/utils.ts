import { clsx, type ClassValue } from "clsx";
import { Tractor, Sprout, Wheat, TreePine, Grape, type LucideIcon } from "lucide-react";
import type { ResourceMode, CatalogItem, OngoingAction, Parcel, SurfaceType, Weather } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDuration(seconds: number) {
  if (seconds <= 0) return "terminé";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

export const SURFACE_LABELS: Record<string, string> = {
  champ: "Champ",
  forêt: "Forêt",
  vigne: "Vigne",
  entrepôt: "Entrepôt",
};

export interface ActionGroup {
  actionType: string;
  count: number;
  /** Any one matching parcel_id, used to fetch that action's requirements. */
  sampleParcelId: number;
}

// Mirrors backend action_service.HARVEST_REWARDS keys — the action types that
// require growth_progress_percent to reach 100 before start_action accepts
// them (calendar_service.required_growth_days). A parcel whose next_action is
// one of these but isn't done growing yet isn't actually launchable, even
// though parcel_next_action already points to it.
export const HARVEST_ACTION_TYPES = new Set([
  "récolter céréales", "récolter coton", "récolter patates", "recolter raisins", "couper le bois",
]);

// True once a parcel's next_action can actually be started right now — false
// for a harvest-type action still short of 100% growth (start_action would
// reject it server-side with "encore N jours"). Used to keep "what's ready"
// lists (bulk action groups, the dashboard to-do widget) honest instead of
// listing a parcel as launchable when trying it would just error out.
export function isReadyForNextAction(parcel: Parcel): boolean {
  if (!parcel.parcel_next_action || !HARVEST_ACTION_TYPES.has(parcel.parcel_next_action)) return true;
  return parcel.growth_progress_percent == null || parcel.growth_progress_percent >= 100;
}

// Every owned, idle (no ongoing action), actually-launchable parcel,
// clustered by its next_action — the "what needs doing across the whole
// farm" view. Used by both /parcels (full table) and the dashboard's compact
// to-do widget, so a 54-parcel farm never needs a parcel-by-parcel scroll to
// see what's pending. Parcels still growing toward a harvest are excluded
// here (see groupGrowingParcels) rather than listed as falsely ready.
export function groupPendingActions(parcels: Parcel[], ongoingActions: OngoingAction[]): ActionGroup[] {
  const busyParcelIds = new Set(ongoingActions.map((a) => a.parcel_id));
  const groupMap = new Map<string, ActionGroup>();
  for (const parcel of parcels) {
    if (!parcel.is_purchased || !parcel.parcel_next_action || busyParcelIds.has(parcel.parcel_id)) continue;
    if (!isReadyForNextAction(parcel)) continue;
    const existing = groupMap.get(parcel.parcel_next_action);
    if (existing) {
      existing.count += 1;
    } else {
      groupMap.set(parcel.parcel_next_action, {
        actionType: parcel.parcel_next_action,
        count: 1,
        sampleParcelId: parcel.parcel_id,
      });
    }
  }
  return [...groupMap.values()].sort((a, b) => b.count - a.count);
}

export interface GrowingGroup {
  actionType: string;
  count: number;
  /** 0-100 average across the group — always < 100 (100%+ moves to groupPendingActions instead). */
  avgProgress: number;
}

// The complement of groupPendingActions: owned, idle parcels whose next step
// is a harvest that isn't ready yet, clustered the same way, with their
// average growth so "what's coming" is visible alongside "what's ready".
export function groupGrowingParcels(parcels: Parcel[], ongoingActions: OngoingAction[]): GrowingGroup[] {
  const busyParcelIds = new Set(ongoingActions.map((a) => a.parcel_id));
  const totals = new Map<string, { count: number; sum: number }>();
  for (const parcel of parcels) {
    if (!parcel.is_purchased || !parcel.parcel_next_action || busyParcelIds.has(parcel.parcel_id)) continue;
    if (isReadyForNextAction(parcel)) continue;
    const progress = parcel.growth_progress_percent ?? 0;
    const existing = totals.get(parcel.parcel_next_action);
    if (existing) {
      existing.count += 1;
      existing.sum += progress;
    } else {
      totals.set(parcel.parcel_next_action, { count: 1, sum: progress });
    }
  }
  return [...totals.entries()]
    .map(([actionType, { count, sum }]) => ({ actionType, count, avgProgress: sum / count }))
    .sort((a, b) => b.count - a.count);
}

export interface CycleStep {
  id: string;
  label: string;
  matches: (actionType: string) => boolean;
}

// The full repeating action cycle per surface type, for display only (see
// CycleStepper) — not the source of truth for what happens next (that's
// always the backend's Action.next_action chain). "mettre engrais X" is
// collapsed to one generic "Engrais" step and "récolter X" to one generic
// "Récolter" step regardless of which crop family was actually planted, so
// the cycle reads the same for every champ.
const CHAMP_CYCLE: CycleStep[] = [
  { id: "labourer", label: "Labourer", matches: (a) => a === "labourer" },
  { id: "semer", label: "Semer", matches: (a) => a === "semer" },
  { id: "engrais", label: "Engrais", matches: (a) => a.startsWith("mettre engrais") },
  { id: "recolter", label: "Récolter", matches: (a) => a.startsWith("récolter") },
];

const VIGNE_CYCLE: CycleStep[] = [
  { id: "planter", label: "Planter", matches: (a) => a === "planter des vignes" },
  { id: "recolter", label: "Récolter", matches: (a) => a === "recolter raisins" },
];

const FORET_CYCLE: CycleStep[] = [
  { id: "planter", label: "Planter", matches: (a) => a === "planter des arbres" },
  { id: "couper", label: "Couper", matches: (a) => a === "couper le bois" },
];

export function getCropCycle(typeSurface: SurfaceType): CycleStep[] | null {
  if (typeSurface === "champ") return CHAMP_CYCLE;
  if (typeSurface === "vigne") return VIGNE_CYCLE;
  if (typeSurface === "forêt") return FORET_CYCLE;
  return null;
}

export function currentCycleIndex(cycle: CycleStep[], actionType: string | null | undefined): number {
  if (!actionType) return -1;
  return cycle.findIndex((step) => step.matches(actionType));
}

// Mirrors backend calendar_service.GROWING_NEXT_ACTIONS — a parcel is at risk
// from frost/heatwave damage while its next action falls in this set (crop
// sown/planted but not yet harvested).
export const GROWING_NEXT_ACTIONS = new Set([
  "mettre engrais céréales", "récolter céréales",
  "mettre engrais coton", "récolter coton",
  "mettre engrais patates", "récolter patates",
  "recolter raisins", "couper le bois",
]);

// A parcel is exposed to today's frost/heatwave damage: owned, growing (not
// an entrepôt, not idle/empty), and not already protected for today. Used to
// be reimplemented slightly differently in FarmMap/ParcelPanel/WeatherCard/
// the parcels page — one definition now so the four can't drift apart.
export function isParcelAtRisk(parcel: Parcel, weather: Weather | undefined): boolean {
  return (
    parcel.is_purchased &&
    parcel.type_surface !== "entrepôt" &&
    !!parcel.parcel_next_action &&
    GROWING_NEXT_ACTIONS.has(parcel.parcel_next_action) &&
    !parcel.protected_today &&
    (weather === "gel" || weather === "canicule")
  );
}

// Mirrors backend config.settings.labor_rate_usd — a flat cost charged per
// action_time_minutes, no worker roster/availability concept to account for.
export const LABOR_RATE_USD = 50;

// Mirrors backend action_service.CHAMP_SEED_MARKER / CHAMP_SEED_SUBCATEGORIES
// — the generic "semer" action's seed requirement stores this pseudo-
// subcategory instead of one specific crop family's real one, so a resource
// picker for it must offer items from all three families at once.
export const CHAMP_SEED_MARKER = "graines";
export const CHAMP_SEED_SUBCATEGORIES = ["graines céréales", "graines coton", "graines patates"];

// Mirrors backend action_service.equipment_duration_multiplier — a vehicule/
// accessoire's speed is its price ranked against siblings of the same
// subcategory (cheapest = slowest, priciest = fastest). Kept in sync with the
// backend constants so the pre-launch preview (time + cost below) matches
// what start_action will actually charge/take once the action begins.
const EQUIPMENT_SPEED_SLOWEST_MULTIPLIER = 1.15;
const EQUIPMENT_SPEED_FASTEST_MULTIPLIER = 0.8;

// Mirrors backend transaction categories written by wallet_service call
// sites across catalog/inventory/market/action/parcel/loan services — kept
// here so the ledger UI (/invoices) and any future consumer share one
// French label set instead of each re-guessing category -> label.
export const TRANSACTION_CATEGORY_LABELS: Record<string, string> = {
  achat_materiel: "Achat de matériel",
  achat_consommable: "Achat de consommables",
  achat_parcelle: "Achat de parcelle",
  vente_recolte: "Vente de récolte",
  vente_materiel: "Vente de matériel",
  cout_action: "Coût d'activité",
  amelioration_stockage: "Amélioration de stockage",
  protection: "Protection météo",
  pret_octroi: "Prêt accordé",
  pret_remboursement: "Remboursement de prêt",
  triche: "Ajustement (debug)",
  autre: "Autre",
};

export function equipmentDurationMultiplier(
  catalog: CatalogItem[],
  category: string,
  subcategory: string,
  price: number
) {
  if (category !== "vehicules" && category !== "accessoires") return 1;
  const prices = catalog
    .filter((i) => i.category === category && i.subcategory === subcategory)
    .map((i) => i.price);
  if (prices.length <= 1) return 1;
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  if (hi === lo) return 1;
  const t = (price - lo) / (hi - lo);
  return EQUIPMENT_SPEED_SLOWEST_MULTIPLIER + (EQUIPMENT_SPEED_FASTEST_MULTIPLIER - EQUIPMENT_SPEED_SLOWEST_MULTIPLIER) * t;
}

// A resource <select> needs one string value per option that round-trips both
// which catalog item was picked and whether it's owned or rented — used by
// every action-launch resource picker (single-parcel and bulk alike).
export function encodeResourceValue(itemId: number, mode: ResourceMode) {
  return mode === "rent" ? `rent:${itemId}` : `${itemId}`;
}

export function decodeResourceValue(value: string | undefined): { itemId: number; mode: ResourceMode } | null {
  if (!value) return null;
  if (value.startsWith("rent:")) return { itemId: Number(value.slice(5)), mode: "rent" };
  return { itemId: Number(value), mode: "own" };
}

export function iconForAction(actionType: string): LucideIcon {
  if (actionType.includes("récolter") || actionType.includes("recolter")) {
    if (actionType.includes("raisins")) return Grape;
    return Wheat;
  }
  if (actionType.includes("couper") || actionType.includes("planter")) return TreePine;
  if (actionType.includes("engrais")) return Sprout;
  return Tractor;
}

import { clsx, type ClassValue } from "clsx";
import { Tractor, Sprout, Wheat, TreePine, Grape, type LucideIcon } from "lucide-react";
import type { ResourceMode } from "./types";

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

export const SURFACE_COLORS: Record<string, string> = {
  champ: "#8ccb93",
  forêt: "#2c7838",
  vigne: "#c99a3b",
  entrepôt: "#8a8577",
};

// Mirrors backend calendar_service.GROWING_NEXT_ACTIONS — a parcel is at risk
// from frost/heatwave damage while its next action falls in this set (crop
// sown/planted but not yet harvested).
export const GROWING_NEXT_ACTIONS = new Set([
  "mettre engrais céréales", "récolter céréales",
  "mettre engrais coton", "récolter coton",
  "mettre engrais patates", "récolter patates",
  "recolter raisins", "couper le bois",
]);

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

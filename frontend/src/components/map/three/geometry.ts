import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

// Keep the original map's parcel IDs and geography; SVG pixels become metres.
export function mapShapes(d: string): THREE.Shape[] {
  const paths = new SVGLoader().parse(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`,
  ).paths;
  return paths
    .flatMap((path) => path.toShapes())
    .map((shape) => {
      const convert = (points: THREE.Vector2[]) =>
        points.map(
          (p) => new THREE.Vector2((p.x - 548) / 10, -(p.y - 548) / 10),
        );
      const result = new THREE.Shape(convert(shape.getPoints()));
      result.holes = shape.holes.map(
        (hole) => new THREE.Path(convert(hole.getPoints())),
      );
      return result;
    });
}

export function containsPoint(points: THREE.Vector2[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

export function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export type FarmVisualStage =
  | "warehouse"
  | "field-fallow"
  | "field-tilled"
  | "field-growing"
  | "field-fertilized"
  | "field-ripe"
  | "forest-cleared"
  | "forest-growing"
  | "forest-mature"
  | "vineyard-bare"
  | "vineyard-growing"
  | "vineyard-mature";

export function farmVisualStage(parcel: {
  type_surface: string;
  parcel_next_action: string | null;
  planted_seed_name: string | null;
  growth_progress_percent: number | null;
  fertilized?: boolean;
}): FarmVisualStage {
  if (parcel.type_surface === "entrepôt") return "warehouse";
  const planted = Boolean(parcel.planted_seed_name);
  const mature = (parcel.growth_progress_percent ?? 0) >= 100;
  if (parcel.type_surface === "forêt")
    return !planted
      ? "forest-cleared"
      : mature
        ? "forest-mature"
        : "forest-growing";
  if (parcel.type_surface === "vigne")
    return !planted
      ? "vineyard-bare"
      : mature
        ? "vineyard-mature"
        : "vineyard-growing";
  if (!planted)
    return parcel.parcel_next_action === "semer"
      ? "field-tilled"
      : "field-fallow";
  if (mature) return "field-ripe";
  return parcel.fertilized ? "field-fertilized" : "field-growing";
}

export function fieldColor(
  parcel: {
    type_surface: string;
    parcel_next_action: string | null;
    planted_seed_name: string | null;
    growth_progress_percent: number | null;
    fertilized?: boolean;
  },
  id: number,
) {
  const stage = farmVisualStage(parcel);
  const colors: Partial<Record<FarmVisualStage, string>> = {
    warehouse: "#cdc4a9",
    "field-tilled": "#866344",
    "field-growing": "#88a650",
    "field-fertilized": "#729a43",
    "field-ripe": "#d4b85d",
    "forest-cleared": "#9a8a63",
    "forest-growing": "#68805a",
    "forest-mature": "#4f7048",
    "vineyard-bare": "#a08c70",
    "vineyard-growing": "#859267",
    "vineyard-mature": "#74885c",
  };
  return colors[stage] ?? ["#b7bf79", "#c1bb7c", "#a7b97b", "#9baa69", "#d0c28d"][id % 5];
}

/** Screen-space placement keeps a small parcel's button from intercepting its neighbour. */
export function placeMarker(
  x: number,
  y: number,
  width: number,
  height: number,
  occupied: { x: number; y: number }[],
) {
  const offsets = [
    [0, 0],
    [0, -25],
    [26, 0],
    [-26, 0],
    [0, 25],
    [26, -25],
    [-26, -25],
  ];
  for (const [dx, dy] of offsets) {
    const candidate = { x: x + dx, y: y + dy };
    if (
      candidate.x > 14 &&
      candidate.x < width - 14 &&
      candidate.y > 14 &&
      candidate.y < height - 14 &&
      occupied.every(
        (p) =>
          Math.abs(p.x - candidate.x) > 26 || Math.abs(p.y - candidate.y) > 24,
      )
    )
      return candidate;
  }
  return null;
}

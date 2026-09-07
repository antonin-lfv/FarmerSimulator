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

export function fieldColor(
  parcel: {
    type_surface: string;
    parcel_next_action: string | null;
    planted_seed_name: string | null;
    growth_progress_percent: number | null;
  },
  id: number,
) {
  if (parcel.type_surface === "forêt") return "#5b7850";
  if (parcel.type_surface === "vigne") return "#8e9771";
  if (parcel.type_surface === "entrepôt") return "#cdc4a9";
  if (parcel.planted_seed_name)
    return (parcel.growth_progress_percent ?? 0) > 75 ? "#d4b85d" : "#92ac54";
  if (parcel.parcel_next_action === "semer") return "#987957";
  return ["#b7bf79", "#c1bb7c", "#a7b97b", "#9baa69", "#d0c28d"][id % 5];
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

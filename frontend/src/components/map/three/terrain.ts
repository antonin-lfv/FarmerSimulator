import * as THREE from "three";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";

export type HeightAt = (x: number, z: number) => number;

/** Shared smooth hills; low banks keep the ocean, ponds and river at water level. */
export function createTerrain(water: THREE.Vector2[][]): HeightAt {
  const size = 113;
  const heights = new Float32Array(size * size);
  const inside = (polygon: THREE.Vector2[], x: number, z: number) => {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > -z) !== (b.y > -z) && x < (b.x - a.x) * (-z - a.y) / (b.y - a.y) + a.x)
        result = !result;
    }
    return result;
  };
  const wet: [number, number][] = [];
  for (let z = -56; z <= 56; z++)
    for (let x = -56; x <= 56; x++)
      if (water.some((polygon) => inside(polygon, x, z))) wet.push([x, z]);
  for (let z = -56; z <= 56; z++) {
    for (let x = -56; x <= 56; x++) {
      let distance = 16 * 16;
      for (const [wx, wz] of wet) distance = Math.min(distance, (wx - x) ** 2 + (wz - z) ** 2);
      const bank = THREE.MathUtils.smoothstep(Math.sqrt(distance), 1.5, 16);
      const hill = (cx: number, cz: number, radius: number, height: number) =>
        height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (radius ** 2));
      heights[(z + 56) * size + x + 56] = bank * (
        0.6 + hill(-19, -33, 22, 10) + hill(17, -8, 24, 6.5) + hill(-6, 31, 21, 5)
      );
    }
  }
  return (x, z) => {
    const gx = THREE.MathUtils.clamp(x + 56, 0, 111.999);
    const gz = THREE.MathUtils.clamp(z + 56, 0, 111.999);
    const ix = Math.floor(gx), iz = Math.floor(gz), dx = gx - ix, dz = gz - iz;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(heights[iz * size + ix], heights[iz * size + ix + 1], dx),
      THREE.MathUtils.lerp(heights[(iz + 1) * size + ix], heights[(iz + 1) * size + ix + 1], dx), dz,
    );
  };
}

/** Subdivide before draping: large triangles must also follow hills in their interior. */
export function drapeGeometry(source: THREE.BufferGeometry, heightAt: HeightAt) {
  const result = new TessellateModifier(1.4, 12).modify(source);
  const positions = result.getAttribute("position");
  for (let i = 0; i < positions.count; i++)
    positions.setY(i, positions.getY(i) + heightAt(positions.getX(i), positions.getZ(i)));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

export function terrainNormal(heightAt: HeightAt, x: number, z: number) {
  const step = 0.35;
  return new THREE.Vector3(
    heightAt(x - step, z) - heightAt(x + step, z), 2 * step,
    heightAt(x, z - step) - heightAt(x, z + step),
  ).normalize();
}

/** A straight work lane fully inside the polygon, with clearance for the whole vehicle. */
export function vehicleLane(points: THREE.Vector2[]) {
  const bounds = new THREE.Box2().setFromPoints(points);
  const inside = (x: number, y: number) => {
    let result = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)
        result = !result;
    }
    return result;
  };
  let best: [THREE.Vector2, THREE.Vector2] | null = null;
  let length = 0;
  // Test both axes; never connect two disjoint intervals of a concave parcel.
  for (const vertical of [false, true]) {
    const min = vertical ? bounds.min.x : bounds.min.y;
    const max = vertical ? bounds.max.x : bounds.max.y;
    const start = vertical ? bounds.min.y : bounds.min.x;
    const end = vertical ? bounds.max.y : bounds.max.x;
    for (let row = min + 0.9; row < max - 0.9; row += 0.8) {
      let run: THREE.Vector2 | null = null;
      for (let t = start + 0.9; t < end - 0.9; t += 0.25) {
        const p = new THREE.Vector2(vertical ? row : t, vertical ? t : row);
        const safe = [-0.8, 0, 0.8].every((dx) => [-0.8, 0, 0.8].every((dy) => inside(p.x + dx, p.y + dy)));
        if (!safe) { run = null; continue; }
        if (!run) run = p;
        if (p.distanceTo(run) > length) { length = p.distanceTo(run); best = [run, p]; }
      }
    }
  }
  return best;
}

export interface VehicleLaneMotion {
  t: number;
  direction: 1 | -1;
}

/** Continuous back-and-forth movement at a readable speed, independent of job duration. */
export function vehicleLaneMotion(
  elapsedSeconds: number,
  laneLength: number,
  speed = 1.4,
): VehicleLaneMotion {
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(laneLength) || laneLength <= 0 || speed <= 0) {
    return { t: 0, direction: 1 };
  }

  const legProgress = Math.max(0, elapsedSeconds) * speed / laneLength;
  const leg = Math.floor(legProgress);
  const fraction = legProgress - leg;
  const forward = leg % 2 === 0;

  return {
    t: forward ? fraction : 1 - fraction,
    direction: forward ? 1 : -1,
  };
}

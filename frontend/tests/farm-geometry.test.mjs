import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser } from "linkedom";
import {
  Box3,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import {
  mapShapes,
  containsPoint,
  fieldColor,
  placeMarker,
  seededRandom,
} from "../src/components/map/three/geometry.ts";
import { PARCEL_PATHS } from "../src/data/parcelPaths.ts";

globalThis.DOMParser = DOMParser;

test("the 54 original parcels remain unique, finite and triangulatable in world space", () => {
  assert.deepEqual(
    PARCEL_PATHS.map((p) => p.parcelId).sort((a, b) => a - b),
    Array.from({ length: 54 }, (_, i) => i + 1),
  );
  for (const { parcelId, d } of PARCEL_PATHS) {
    const shapes = mapShapes(d);
    assert.ok(shapes.length > 0, `Missing parcel ${parcelId}`);
    const geometry = new ExtrudeGeometry(shapes, {
      depth: 0.35,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute("position");
    assert.ok(positions.count > 3, `Empty parcel ${parcelId}`);
    assert.ok(
      Array.from(positions.array).every(Number.isFinite),
      `Invalid parcel ${parcelId}`,
    );
    const bounds = new Box3().setFromBufferAttribute(positions);
    assert.ok(
      bounds.min.x >= -55 &&
        bounds.max.x <= 55 &&
        bounds.min.z >= -55 &&
        bounds.max.z <= 55,
      `Misaligned parcel ${parcelId}`,
    );
    assert.ok(
      Math.abs(bounds.max.y - 0.35) < 0.0001,
      `Inverted extrusion ${parcelId}`,
    );
    geometry.dispose();
  }
});

test("SVG east/south directions and upward faces support clicking the ground", () => {
  const geometry = new ExtrudeGeometry(mapShapes("M548 548h100v100h-100z"), {
    depth: 0.35,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.updateMatrixWorld();
  const ray = new Raycaster(new Vector3(5, 10, 5), new Vector3(0, -1, 0));
  assert.ok(
    ray.intersectObject(mesh).length > 0,
    "The surface must face a camera above the ground",
  );
  const outside = new Raycaster(new Vector3(-5, 10, 5), new Vector3(0, -1, 0));
  assert.equal(
    outside.intersectObject(mesh).length,
    0,
    "Do not mirror the parcel on the east/west axis",
  );
  geometry.dispose();
  material.dispose();
});

test("vegetation placement excludes the notch of concave parcels", () => {
  const l = [
    [0, 0],
    [6, 0],
    [6, 2],
    [2, 2],
    [2, 6],
    [0, 6],
  ].map(([x, y]) => new Vector2(x, y));
  assert.equal(containsPoint(l, 1, 5), true);
  assert.equal(containsPoint(l, 5, 1), true);
  assert.equal(containsPoint(l, 5, 5), false);
  assert.equal(containsPoint(l, -1, 1), false);
  assert.equal(containsPoint([...l].reverse(), 1, 5), true);
});

test("crop appearance distinguishes tilled soil, growth and ripe harvests", () => {
  const field = {
    type_surface: "champ",
    parcel_next_action: "semer",
    planted_seed_name: null,
    growth_progress_percent: null,
  };
  const soil = fieldColor(field, 7);
  const growing = fieldColor(
    { ...field, planted_seed_name: "Blé", growth_progress_percent: 30 },
    7,
  );
  const ripe = fieldColor(
    { ...field, planted_seed_name: "Blé", growth_progress_percent: 100 },
    7,
  );
  assert.notEqual(soil, growing);
  assert.notEqual(growing, ripe);
});

test("rebuilding the same parcel preserves its procedural layout", () => {
  const a = seededRandom(7),
    b = seededRandom(7),
    c = seededRandom(8);
  const sequence = Array.from({ length: 100 }, a);
  assert.deepEqual(sequence, Array.from({ length: 100 }, b));
  assert.notDeepEqual(sequence, Array.from({ length: 100 }, c));
  assert.ok(sequence.every((v) => v >= 0 && v < 1));
});

test("crowded parcel markers never cover a neighbouring click target", () => {
  const placed = [];
  for (let i = 0; i < 54; i++) {
    const point = placeMarker(100 + (i % 5), 100 + (i % 3), 390, 540, placed);
    if (point) placed.push(point);
  }
  assert.ok(placed.length > 1);
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      assert.ok(
        Math.abs(placed[i].x - placed[j].x) > 26 ||
          Math.abs(placed[i].y - placed[j].y) > 24,
      );
    }
  }
  assert.equal(placeMarker(-100, -100, 390, 540, []), null);
});

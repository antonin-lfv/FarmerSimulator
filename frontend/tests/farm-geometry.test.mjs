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
  farmVisualStage,
  fieldColor,
  placeMarker,
  seededRandom,
} from "../src/components/map/three/geometry.ts";
import { PARCEL_PATHS } from "../src/data/parcelPaths.ts";
import { WATER_REGIONS } from "../src/data/mapDecor.ts";
import { createTerrain, drapeGeometry, terrainNormal, vehicleLane } from "../src/components/map/three/terrain.ts";

globalThis.DOMParser = DOMParser;

const water = WATER_REGIONS.flatMap((region) => mapShapes(region.d).map((shape) => shape.getPoints()));
const heightAt = createTerrain(water);

test("terrain has hills, continuous heights, and low water banks", () => {
  let peak = 0;
  for (let x = -54; x < 54; x += 1) for (let z = -54; z < 54; z += 1) {
    const h = heightAt(x, z);
    assert.ok(Number.isFinite(h) && h >= 0);
    peak = Math.max(peak, h);
    assert.ok(Math.abs(h - heightAt(x + 0.1, z)) < 0.13, `Abrupt slope at ${x}, ${z}`);
    assert.ok(Math.abs(h - heightAt(x, z + 0.1)) < 0.13, `Abrupt slope at ${x}, ${z}`);
    if (water.some((points) => containsPoint(points, x, -z))) assert.ok(h < 0.01);
    assert.ok(terrainNormal(heightAt, x, z).y > 0.55);
  }
  assert.ok(peak > 6, "The hills must visibly rise above the flat coast");
});

test("all vehicle lanes keep wheels inside parcels and on raycastable relief", () => {
  for (const { parcelId, d } of PARCEL_PATHS) {
    const shapes = mapShapes(d), points = shapes[0].getPoints();
    const lane = vehicleLane(points);
    assert.ok(lane, `No work lane for parcel ${parcelId}`);
    const source = new ExtrudeGeometry(shapes, { depth: 0.35, bevelEnabled: false });
    source.rotateX(-Math.PI / 2);
    const geometry = drapeGeometry(source, heightAt);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.position.y = 0.18;
    mesh.updateMatrixWorld();
    for (let i = 0; i <= 40; i++) {
      const p = lane[0].clone().lerp(lane[1], i / 40);
      for (const dx of [-0.7, 0, 0.7]) for (const dy of [-0.7, 0, 0.7])
        assert.ok(containsPoint(points, p.x + dx, p.y + dy), `Vehicle leaves parcel ${parcelId}`);
      const hit = new Raycaster(new Vector3(p.x, 30, -p.y), new Vector3(0, -1, 0)).intersectObject(mesh)[0];
      assert.ok(hit, `Missing terrain below vehicle on parcel ${parcelId}`);
      assert.ok(Math.abs(hit.point.y - heightAt(p.x, -p.y) - 0.53) < 0.13, `Vehicle floats on parcel ${parcelId}`);
    }
    source.dispose(); geometry.dispose(); material.dispose();
  }
});

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

test("every farming step maps to a distinct 3D stage", () => {
  const field = {
    type_surface: "champ",
    parcel_next_action: "labourer",
    planted_seed_name: null,
    growth_progress_percent: null,
    fertilized: false,
  };
  assert.equal(farmVisualStage(field), "field-fallow");
  assert.equal(
    farmVisualStage({ ...field, parcel_next_action: "semer" }),
    "field-tilled",
  );
  assert.equal(
    farmVisualStage({
      ...field,
      planted_seed_name: "Blé",
      growth_progress_percent: 35,
    }),
    "field-growing",
  );
  assert.equal(
    farmVisualStage({
      ...field,
      planted_seed_name: "Blé",
      growth_progress_percent: 35,
      fertilized: true,
    }),
    "field-fertilized",
  );
  assert.equal(
    farmVisualStage({
      ...field,
      planted_seed_name: "Blé",
      growth_progress_percent: 100,
      fertilized: true,
    }),
    "field-ripe",
  );
  assert.equal(
    farmVisualStage({ ...field, type_surface: "forêt" }),
    "forest-cleared",
  );
  assert.equal(
    farmVisualStage({ ...field, type_surface: "vigne" }),
    "vineyard-bare",
  );
  assert.equal(
    farmVisualStage({ ...field, type_surface: "entrepôt" }),
    "warehouse",
  );
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

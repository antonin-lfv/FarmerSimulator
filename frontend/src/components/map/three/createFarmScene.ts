import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PARCEL_PATHS } from "@/data/parcelPaths";
import { WATER_REGIONS } from "@/data/mapDecor";
import type { OngoingAction, Parcel, Weather } from "@/lib/types";
import { isParcelAtRisk } from "@/lib/utils";
import {
  containsPoint,
  farmVisualStage,
  fieldColor,
  mapShapes,
  placeMarker,
  seededRandom,
} from "./geometry";
import { createWeatherEffects } from "./weatherEffects";
import { createTerrain, drapeGeometry, terrainNormal, vehicleLane } from "./terrain";

export type MapFilter = "all" | "owned" | "sale" | "active";
export type MapCommand = "in" | "out" | "home" | "top" | "focus";
export interface SceneState {
  parcels: Parcel[];
  ongoingActions: OngoingAction[];
  selectedId: number | null;
  weather?: Weather;
  filter: MapFilter;
  labels: boolean;
}
interface Plot {
  id: number;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  outline: THREE.LineLoop;
  decor: THREE.Group;
  signature: string;
  points: THREE.Vector2[];
  center: THREE.Vector3;
  label: HTMLButtonElement;
  weatherDecor: THREE.Group;
  weatherSignature: string;
  lane: ReturnType<typeof vehicleLane>;
  machine: THREE.Group | null;
  leader: HTMLSpanElement;
}

const LABEL_SCREEN_OFFSETS: Partial<Record<number, readonly [number, number]>> = {
  2: [-36, 0],
  5: [36, 0],
  45: [-42, 0],
  47: [36, 36],
};

export function createFarmScene(
  host: HTMLDivElement,
  labelHost: HTMLDivElement,
  onSelect: (id: number) => void,
  onError: () => void,
  compass: HTMLSpanElement | null = null,
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor("#dce5d8");
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "Carte 3D de la ferme. Glisser pour tourner, clic droit pour déplacer, molette pour zoomer. Flèches pour déplacer, plus et moins pour zoomer, R pour recentrer.",
  );
  const scene = new THREE.Scene();
  const heightAt = createTerrain(WATER_REGIONS.flatMap((region) => mapShapes(region.d).map((shape) => shape.getPoints())));
  scene.fog = new THREE.Fog("#dce5d8", 230, 440);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 550);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 22;
  controls.maxDistance = 235;
  controls.maxPolarAngle = Math.PI / 2.35;
  controls.minPolarAngle = 0.05;
  controls.maxTargetRadius = 65;
  controls.screenSpacePanning = false;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  const home = new THREE.Vector3(95, 118, 132);
  camera.position.copy(home);
  controls.target.set(0, heightAt(0, 8), 8);
  controls.update();
  const hemisphere = new THREE.HemisphereLight("#fff4df", "#769482", 2.7);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight("#fff0d4", 3.4);
  sun.position.set(-55, 95, -35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -85,
    right: 85,
    top: 85,
    bottom: -85,
    near: 1,
    far: 230,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.2;
  scene.add(sun);
  const weatherEffects = createWeatherEffects(
    scene,
    renderer,
    hemisphere,
    sun,
    reducedMotion,
    heightAt,
  );

  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  function material(color: string) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      flatShading: true,
    });
    materials.add(mat);
    return mat;
  }
  function geometry<T extends THREE.BufferGeometry>(geo: T): T {
    geometries.add(geo);
    return geo;
  }
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cone = geometry(new THREE.ConeGeometry(1, 1, 7));
  const roofGeometry = geometry(new THREE.CylinderGeometry(1, 1, 1, 3));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 10));
  const sphere = geometry(new THREE.SphereGeometry(1, 8, 6));
  const trunkMat = material("#76604a"),
    leafMat = material("#ffffff"),
    cropMat = material("#ffffff");
  const wallMat = material("#eee2c6"),
    roofMat = material("#9c6048"),
    darkMat = material("#566568");
  const tractorMat = material("#d69338"),
    harvesterMat = material("#c7a543"),
    forestryMat = material("#b85f3b"),
    wheelMat = material("#303936");
  const flameMat = new THREE.MeshStandardMaterial({
    color: "#ffad42",
    emissive: "#ff5b1f",
    emissiveIntensity: 2.4,
    toneMapped: false,
    roughness: 0.7,
  });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: "#6f7974",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  materials.add(flameMat);
  materials.add(smokeMat);
  function block(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + (parent.userData.followsTerrain ? heightAt(x, z) : 0), z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const baseSource = new THREE.BoxGeometry(111, 3.2, 111, 80, 1, 80);
  baseSource.translate(0, -1.6, 0);
  const base = geometry(drapeGeometry(baseSource, (x, z) => heightAt(x, z)));
  baseSource.dispose();
  const baseMesh = new THREE.Mesh(base, material("#b6a58a"));
  scene.add(baseMesh);
  const groundSource = new THREE.PlaneGeometry(111, 111, 90, 90);
  groundSource.rotateX(-Math.PI / 2);
  groundSource.translate(0, 0.15, 0);
  const ground = new THREE.Mesh(geometry(drapeGeometry(groundSource, heightAt)), material("#c5c5a0"));
  groundSource.dispose();
  ground.receiveShadow = true;
  scene.add(ground);
  const floor = block(
    scene,
    box,
    material("#dce5d8"),
    0,
    -3.8,
    0,
    1500,
    1,
    1500,
  );
  floor.castShadow = false;

  const waterMat = new THREE.MeshStandardMaterial({
    color: "#71b5bb",
    roughness: 0.28,
    metalness: 0.15,
  });
  materials.add(waterMat);
  for (const region of WATER_REGIONS) {
    const geo = geometry(new THREE.ShapeGeometry(mapShapes(region.d)));
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, waterMat);
    water.position.y = 0.19;
    scene.add(water);
  }
  // Small ripples stay on the coastal water, away from the playable land.
  const ripples = new THREE.Group();
  const rippleMat = new THREE.MeshBasicMaterial({
    color: "#d6efde",
    transparent: true,
    opacity: 0.32,
  });
  materials.add(rippleMat);
  const random = seededRandom(123);
  for (let i = 0; i < 45; i++) {
    block(
      ripples,
      box,
      rippleMat,
      -53 + random() * 4,
      0.23,
      -45 + random() * 93,
      0.08,
      0.02,
      0.7 + random() * 1.8,
    ).castShadow = false;
  }
  scene.add(ripples);
  const plots: Plot[] = [];
  for (const { parcelId, d } of PARCEL_PATHS) {
    const shapes = mapShapes(d);
    const source = new THREE.ExtrudeGeometry(shapes, { depth: 0.35, bevelEnabled: false });
    source.rotateX(-Math.PI / 2);
    const geo = geometry(drapeGeometry(source, heightAt));
    source.dispose();
    const mesh = new THREE.Mesh(geo, material("#afba79"));
    mesh.position.y = 0.18;
    mesh.receiveShadow = true;
    mesh.userData.parcelId = parcelId;
    scene.add(mesh);
    const points = shapes[0].getPoints();
    const borderPoints: THREE.Vector3[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const steps = Math.max(1, Math.ceil(a.distanceTo(b) / 0.7));
      for (let j = 0; j < steps; j++) {
        const p = a.clone().lerp(b, j / steps);
        borderPoints.push(new THREE.Vector3(p.x, heightAt(p.x, -p.y) + 0.6, -p.y));
      }
    }
    const borderGeo = geometry(new THREE.BufferGeometry().setFromPoints(borderPoints));
    const lineMat = new THREE.LineBasicMaterial({
      color: "#eee5b9",
      transparent: true,
      opacity: 0.5,
    });
    materials.add(lineMat);
    const outline = new THREE.LineLoop(borderGeo, lineMat);
    scene.add(outline);
    const bounds = new THREE.Box2().setFromPoints(points);
    let middle = bounds.getCenter(new THREE.Vector2());
    // A bounding-box centre can fall outside a concave parcel; use an interior grid point.
    if (!containsPoint(points, middle.x, middle.y)) {
      const candidates: THREE.Vector2[] = [];
      for (let x = bounds.min.x + 0.2; x < bounds.max.x; x += 0.5)
        for (let y = bounds.min.y + 0.2; y < bounds.max.y; y += 0.5)
          if (containsPoint(points, x, y))
            candidates.push(new THREE.Vector2(x, y));
      candidates.sort(
        (a, b) => a.distanceToSquared(middle) - b.distanceToSquared(middle),
      );
      middle = candidates[0] ?? middle;
    }
    const center = new THREE.Vector3(middle.x, heightAt(middle.x, -middle.y) + 2.8, -middle.y);
    const decor = new THREE.Group();
    scene.add(decor);
    const weatherDecor = new THREE.Group();
    weatherDecor.userData.followsTerrain = true;
    scene.add(weatherDecor);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "plot-marker";
    label.textContent = String(parcelId).padStart(2, "0");
    label.setAttribute("aria-label", `Sélectionner la parcelle ${parcelId}`);
    label.addEventListener("click", () => onSelect(parcelId));
    labelHost.appendChild(label);
    const leader = document.createElement("span");
    leader.className = "plot-leader";
    leader.setAttribute("aria-hidden", "true");
    labelHost.appendChild(leader);
    plots.push({
      id: parcelId,
      mesh,
      outline,
      decor,
      signature: "",
      points,
      center,
      label,
      weatherDecor,
      weatherSignature: "",
      lane: vehicleLane(points),
      machine: null,
      leader,
    });
  }

  function addWorkingMachine(
    plot: Plot,
    ongoing: OngoingAction | undefined,
  ) {
    if (!ongoing || !plot.lane) return;
    const machine = new THREE.Group();
    const bodyMaterial = ongoing.action_type.includes("récolter")
      ? harvesterMat
      : ongoing.action_type.includes("bois")
        ? forestryMat
        : tractorMat;
    block(machine, box, bodyMaterial, 0, 0.45, 0, 1.25, 0.65, 0.75);
    block(machine, box, darkMat, -0.25, 0.95, 0, 0.55, 0.55, 0.62);
    for (const x of [-0.45, 0.45])
      for (const z of [-0.43, 0.43]) {
        const wheel = block(machine, cylinder, wheelMat, x, 0.15, z, 0.25, 0.18, 0.25);
        wheel.rotation.x = Math.PI / 2;
      }
    plot.decor.add(machine);
    plot.machine = machine;
  }

  function decorate(
    plot: Plot,
    parcel: Parcel,
    ongoing: OngoingAction | undefined,
  ) {
    plot.machine = null;
    plot.decor.userData.followsTerrain = parcel.type_surface !== "entrepôt";
    plot.decor.position.y = parcel.type_surface === "entrepôt" ? heightAt(plot.center.x, plot.center.z) : 0;
    // Shared geometry/materials are disposed once with the scene; only instances change here.
    for (const child of [...plot.decor.children]) {
      if (child instanceof THREE.InstancedMesh) child.dispose();
      plot.decor.remove(child);
    }
    const bounds = new THREE.Box2().setFromPoints(plot.points);
    const rand = seededRandom(plot.id * 311);
    const stage = farmVisualStage(parcel);
    if (parcel.type_surface === "entrepôt") {
      const width = Math.min(5, (bounds.max.x - bounds.min.x) * 0.5);
      const depth = Math.min(7, (bounds.max.y - bounds.min.y) * 0.5);
      const { x, z } = plot.center;
      const footprintHeights: number[] = [];
      for (let dx = -width / 2; dx <= width / 2; dx += 0.4)
        for (let dz = -depth / 2; dz <= depth / 2; dz += 0.4)
          footprintHeights.push(heightAt(x + dx, z + dz));
      const foundationTop = Math.max(...footprintHeights);
      const foundationDepth = foundationTop - Math.min(...footprintHeights) + 0.25;
      plot.decor.position.y = foundationTop;
      block(plot.decor, box, darkMat, x, 0.55 - foundationDepth / 2, z, width + 0.15, foundationDepth, depth + 0.15);
      block(plot.decor, box, wallMat, x, 1.6, z, width, 2.1, depth);
      const roof = block(
        plot.decor,
        roofGeometry,
        roofMat,
        x,
        3,
        z,
        width * 0.75,
        depth + 0.5,
        width * 0.46,
      );
      roof.rotation.x = Math.PI / 2;
      roof.rotation.y = Math.PI / 4;
      // Gable roof uses a triangular prism rather than a flat painted tile.
      block(
        plot.decor,
        box,
        darkMat,
        x,
        1.3,
        z + depth / 2 + 0.04,
        width * 0.55,
        1.5,
        0.1,
      );
      block(
        plot.decor,
        cylinder,
        wallMat,
        x + width * 0.75,
        2,
        z - 1,
        0.85,
        3,
        0.85,
      );
      block(
        plot.decor,
        cone,
        darkMat,
        x + width * 0.75,
        3.75,
        z - 1,
        0.98,
        0.65,
        0.98,
      );
      return;
    }
    const forest = parcel.type_surface === "forêt";
    const vineyard = parcel.type_surface === "vigne";
    const spacing = forest ? 2.5 : vineyard ? 1.4 : 0.85;
    const positions: { x: number; z: number; scale: number }[] = [];
    for (
      let x = bounds.min.x + spacing / 2;
      x < bounds.max.x - 0.3;
      x += spacing
    ) {
      for (
        let y = bounds.min.y + spacing / 2;
        y < bounds.max.y - 0.3;
        y += forest ? 2.5 : 1.2
      ) {
        const px = x + (forest ? (rand() - 0.5) * 1.3 : 0);
        const py = y + (forest ? (rand() - 0.5) * 1.3 : 0);
        if (
          containsPoint(plot.points, px, py) &&
          containsPoint(plot.points, px + 0.35, py + 0.35) &&
          containsPoint(plot.points, px - 0.35, py - 0.35)
        )
          positions.push({ x: px, z: -py, scale: 0.75 + rand() * 0.6 });
      }
    }
    if (!positions.length) {
      addWorkingMachine(plot, ongoing);
      return;
    }
    const dummy = new THREE.Object3D();
    const progress = Math.max(0.08, (parcel.growth_progress_percent ?? 0) / 100);

    if (stage === "field-tilled") {
      const furrows = new THREE.InstancedMesh(box, trunkMat, positions.length);
      positions.forEach((pos, i) => {
        dummy.position.set(pos.x, heightAt(pos.x, pos.z) + 0.48, pos.z);
        dummy.scale.set(0.13, 0.08, 0.8);
        dummy.updateMatrix();
        furrows.setMatrixAt(i, dummy.matrix);
      });
      furrows.receiveShadow = true;
      plot.decor.add(furrows);
    } else if (stage === "field-fallow") {
      const sparse = positions.filter((_, i) => i % 4 === 0);
      const stubble = new THREE.InstancedMesh(box, cropMat, sparse.length);
      sparse.forEach((pos, i) => {
        dummy.position.set(pos.x, heightAt(pos.x, pos.z) + 0.55, pos.z);
        dummy.scale.set(0.12, 0.18 + (i % 3) * 0.04, 0.12);
        dummy.updateMatrix();
        stubble.setMatrixAt(i, dummy.matrix);
        stubble.setColorAt(i, new THREE.Color(i % 2 ? "#a9ad68" : "#8e995c"));
      });
      plot.decor.add(stubble);
    } else if (forest && stage === "forest-cleared") {
      const cleared = positions.filter((_, i) => i % 3 === 0);
      const stumps = new THREE.InstancedMesh(cylinder, trunkMat, cleared.length);
      cleared.forEach((pos, i) => {
        dummy.position.set(pos.x, heightAt(pos.x, pos.z) + 0.58, pos.z);
        dummy.scale.set(0.28 + (i % 2) * 0.08, 0.3, 0.28 + (i % 2) * 0.08);
        dummy.updateMatrix();
        stumps.setMatrixAt(i, dummy.matrix);
      });
      plot.decor.add(stumps);
    } else if (vineyard && stage === "vineyard-bare") {
      const posts = new THREE.InstancedMesh(cylinder, trunkMat, positions.length);
      positions.forEach((pos, i) => {
        dummy.position.set(pos.x, heightAt(pos.x, pos.z) + 0.9, pos.z);
        dummy.scale.set(0.07, 1.15, 0.07);
        dummy.updateMatrix();
        posts.setMatrixAt(i, dummy.matrix);
      });
      plot.decor.add(posts);
    } else {
      const foliage = new THREE.InstancedMesh(
        forest ? cone : box,
        forest ? leafMat : cropMat,
        positions.length,
      );
      const trunks = forest
        ? new THREE.InstancedMesh(cylinder, trunkMat, positions.length)
        : null;
      positions.forEach((pos, i) => {
        const height = forest
          ? (0.8 + progress * 3) * pos.scale
          : vineyard
            ? 0.3 + progress * 0.75
            : 0.2 + progress * 0.85;
        dummy.position.set(pos.x, heightAt(pos.x, pos.z) + 0.55 + height / 2 + (forest ? 0.45 : 0), pos.z);
        dummy.scale.set(
          forest ? (0.45 + progress) * pos.scale : vineyard ? 0.25 + progress * 0.3 : 0.2,
          height,
          forest ? (0.45 + progress) * pos.scale : 0.9,
        );
        dummy.rotation.y = forest ? rand() * Math.PI : 0;
        dummy.updateMatrix();
        foliage.setMatrixAt(i, dummy.matrix);
        foliage.setColorAt(
          i,
          new THREE.Color(
            forest
              ? ["#315d43", "#4c774b", "#62854e"][i % 3]
              : vineyard
                ? stage === "vineyard-mature"
                  ? i % 4 === 0 ? "#6f456a" : "#607b40"
                  : "#789557"
                : stage === "field-ripe"
                  ? i % 3 === 0 ? "#edcf70" : "#d7b650"
                  : stage === "field-fertilized"
                    ? i % 3 === 0 ? "#a9c867" : "#6f963d"
                    : "#7e9b43",
          ),
        );
        if (trunks) {
          dummy.position.y = heightAt(pos.x, pos.z) + 0.45 + height * 0.25;
          dummy.scale.set(0.12, 0.8 + progress, 0.12);
          dummy.updateMatrix();
          trunks.setMatrixAt(i, dummy.matrix);
        }
      });
      foliage.castShadow = forest || vineyard;
      foliage.receiveShadow = true;
      plot.decor.add(foliage);
      if (trunks) plot.decor.add(trunks);
    }
    addWorkingMachine(plot, ongoing);
  }

  function decorateWeather(plot: Plot, parcel: Parcel) {
    plot.weatherDecor.clear();
    const fire = Boolean(parcel.active_fire);
    if (!fire && (state.weather !== "gel" || !parcel.protected_today || !parcel.planted_seed_name)) return;
    const offsets: [number, number][] = plot.lane
      ? [0.3, 0.5, 0.7].map((t) => {
          const p = plot.lane![0].clone().lerp(plot.lane![1], t);
          return [p.x - plot.center.x, -p.y - plot.center.z];
        })
      : [[0, 0]];
    for (const [x, z] of offsets) {
      if (!containsPoint(plot.points, plot.center.x + x, -(plot.center.z + z))) continue;
      block(
        plot.weatherDecor,
        cylinder,
        darkMat,
        plot.center.x + x,
        0.58,
        plot.center.z + z,
        0.24,
        0.35,
        0.24,
      );
      const flame = block(
        plot.weatherDecor,
        cone,
        flameMat,
        plot.center.x + x,
        fire ? 2.9 : 1.12,
        plot.center.z + z,
        fire ? 0.85 : 0.22,
        fire ? 4.6 : 0.7,
        fire ? 0.85 : 0.22,
      );
      flame.userData.weatherFlame = true;
      flame.userData.baseScaleY = flame.scale.y;
      const smoke = block(
        plot.weatherDecor,
        sphere,
        smokeMat,
        plot.center.x + x + 0.2,
        fire ? 6.8 : 1.9,
        plot.center.z + z,
        fire ? 1.1 : 0.28,
        fire ? 1.8 : 0.5,
        fire ? 1.1 : 0.28,
      );
      smoke.castShadow = false;
      smoke.userData.weatherSmoke = true;
      smoke.userData.baseY = smoke.position.y;
    }
  }

  let state: SceneState = {
    parcels: [],
    ongoingActions: [],
    selectedId: null,
    filter: "all",
    labels: true,
  };
  let hovered: number | null = null;
  let actionSnapshotAt = performance.now();
  let disposed = false;
  let destination: { camera: THREE.Vector3; target: THREE.Vector3 } | null =
    null;
  function paint() {
    const byId = new Map(state.parcels.map((p) => [p.parcel_id, p]));
    const actions = new Map(state.ongoingActions.map((a) => [a.parcel_id, a]));
    for (const plot of plots) {
      const parcel = byId.get(plot.id);
      if (!parcel) {
        plot.label.hidden = true;
        continue;
      }
      const active = actions.has(plot.id);
      const risk = isParcelAtRisk(parcel, state.weather);
      const selected = state.selectedId === plot.id;
      const matches =
        state.filter === "all" ||
        (state.filter === "owned" && parcel.is_purchased) ||
        (state.filter === "sale" && !parcel.is_purchased) ||
        (state.filter === "active" && active);
      const color = new THREE.Color(fieldColor(parcel, plot.id));
      if (state.weather === "gel") color.lerp(new THREE.Color("#e4ece1"), 0.5);
      if (state.weather === "canicule") color.lerp(new THREE.Color("#c3a36b"), 0.28);
      if (parcel.fire_damage_today) color.lerp(new THREE.Color("#3e3530"), 0.7);
      const wet = state.weather === "pluie" || state.weather === "orage";
      if (wet) color.multiplyScalar(0.83);
      plot.mesh.material.roughness = wet ? 0.48 : 0.95;
      plot.mesh.material.metalness = wet ? 0.06 : 0;
      if (!matches) color.lerp(new THREE.Color("#bec4b2"), 0.75);
      plot.mesh.material.color.copy(color);
      plot.mesh.material.emissive.set(
        selected ? "#8fa04f" : hovered === plot.id ? "#6b7441" : "#000000",
      );
      plot.mesh.material.emissiveIntensity = selected ? 0.3 : 0.18;
      const line = plot.outline.material as THREE.LineBasicMaterial;
      line.color.set(
        selected
          ? "#ffffff"
          : risk
            ? "#c76d42"
            : parcel.is_purchased
              ? "#f9efae"
              : "#e7dfb3",
      );
      line.opacity =
        selected || parcel.is_purchased ? 1 : matches ? 0.45 : 0.15;
      plot.decor.visible = matches;
      plot.weatherDecor.visible = matches;
      plot.label.dataset.selected = String(selected);
      plot.label.dataset.owned = String(parcel.is_purchased);
      plot.label.dataset.active = String(active);
      plot.label.dataset.risk = String(risk);
      plot.label.dataset.matches = String(matches);
      plot.label.setAttribute("aria-pressed", String(selected));
      plot.label.title = `Parcelle ${plot.id} · ${parcel.type_surface} · ${parcel.superficie} ha · ${active ? actions.get(plot.id)!.action_type : parcel.is_purchased ? "Possédée" : "À vendre"}${parcel.active_fire ? " · Incendie" : risk ? " · À risque" : ""}`;
      const signature = [
        parcel.type_surface,
        parcel.planted_seed_name,
        Math.floor((parcel.growth_progress_percent ?? 0) / 10),
        parcel.parcel_next_action,
        parcel.fertilized,
        state.weather,
        parcel.protected_today,
        parcel.fire_damage_today,
        actions.get(plot.id)?.action_type,
      ].join("|");
      if (plot.signature !== signature) {
        decorate(plot, parcel, actions.get(plot.id));
        const frost = state.weather === "gel";
        const dry = state.weather === "canicule";
        if (frost || dry || parcel.fire_damage_today) {
          const tint = new THREE.Color(parcel.fire_damage_today ? "#47372d" : frost ? "#e6f3f4" : "#c5aa68");
          const amount = parcel.fire_damage_today ? 0.75 : frost ? (parcel.protected_today ? 0.25 : 0.7) : 0.24;
          const instanceColor = new THREE.Color();
          plot.decor.traverse((child) => {
            if (!(child instanceof THREE.InstancedMesh) || !child.instanceColor) return;
            for (let i = 0; i < child.count; i++) {
              child.getColorAt(i, instanceColor);
              child.setColorAt(i, instanceColor.lerp(tint, amount));
            }
            child.instanceColor.needsUpdate = true;
          });
        }
        plot.signature = signature;
      }
      const weatherSignature = `${state.weather}|${parcel.protected_today}|${parcel.active_fire}|${parcel.planted_seed_name}`;
      if (plot.weatherSignature !== weatherSignature) {
        decorateWeather(plot, parcel);
        plot.weatherSignature = weatherSignature;
      }
    }
    (floor.material as THREE.MeshStandardMaterial).color.set(
      state.weather === "orage" ? "#59666b" : state.weather === "pluie" ? "#9caaa4" : state.weather === "gel" ? "#dce9ed" : state.weather === "canicule" ? "#ead2a7" : "#dce5d8",
    );
    weatherEffects.set(state.weather);
  }
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function pick(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(
      plots.map((p) => p.mesh),
      false,
    )[0]?.object.userData.parcelId as number | undefined;
  }
  let pointerStart: { x: number; y: number; id: number } | null = null;
  let dragged = false;
  function down(event: PointerEvent) {
    if (pointerStart) {
      dragged = true;
      return;
    }
    dragged = false;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    destination = null;
  }
  function move(event: PointerEvent) {
    if (
      pointerStart &&
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) > 5
    )
      dragged = true;
    if (event.buttons) return;
    const id = pick(event) ?? null;
    if (hovered !== id) {
      hovered = id;
      canvas.style.cursor = id ? "pointer" : "grab";
      paint();
    }
  }
  function up(event: PointerEvent) {
    if (pointerStart?.id !== event.pointerId) return;
    const click = !dragged && event.button === 0;
    pointerStart = null;
    if (click) {
      const id = pick(event);
      if (id && state.parcels.some((p) => p.parcel_id === id)) onSelect(id);
    }
  }
  function cancel() {
    pointerStart = null;
    dragged = true;
  }
  function command(action: MapCommand) {
    destination = null;
    if (action === "in" || action === "out") {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(
        THREE.MathUtils.clamp(
          offset.length() * (action === "in" ? 0.8 : 1.25),
          controls.minDistance,
          controls.maxDistance,
        ),
      );
      destination = {
        camera: controls.target.clone().add(offset),
        target: controls.target.clone(),
      };
    } else if (action === "home")
      destination = {
        camera: home.clone(),
        target: new THREE.Vector3(0, heightAt(0, 8), 8),
      };
    else if (action === "top")
      destination = {
        camera: controls.target.clone().add(new THREE.Vector3(0, 130, 0.1)),
        target: controls.target.clone(),
      };
    else {
      const plot = plots.find((p) => p.id === state.selectedId);
      if (!plot) return;
      const target = plot.center.clone().setY(heightAt(plot.center.x, plot.center.z));
      destination = {
        camera: target.clone().add(new THREE.Vector3(25, 38, 38)),
        target,
      };
    }
    if (reducedMotion && destination) {
      camera.position.copy(destination.camera);
      controls.target.copy(destination.target);
      destination = null;
      controls.update();
    }
  }
  function key(event: KeyboardEvent) {
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      z: [0, -1],
      w: [0, -1],
      s: [0, 1],
      q: [-1, 0],
      a: [-1, 0],
      d: [1, 0],
    };
    if (keys[event.key]) {
      event.preventDefault();
      destination = null;
      const [x, z] = keys[event.key];
      const forward = camera.position
        .clone()
        .sub(controls.target)
        .setY(0)
        .normalize();
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const delta = right
        .multiplyScalar(x * 3)
        .add(forward.multiplyScalar(z * 3));
      controls.target.add(delta);
      camera.position.add(delta);
      controls.update();
    } else if (["+", "=", "-", "r", "R"].includes(event.key)) {
      event.preventDefault();
      command(
        event.key === "-"
          ? "out"
          : event.key.toLowerCase() === "r"
            ? "home"
            : "in",
      );
    }
  }
  function contextLost(event: Event) {
    event.preventDefault();
    onError();
  }
  function wheel() {
    destination = null;
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("keydown", key);
  canvas.addEventListener("wheel", wheel, { passive: true });
  canvas.addEventListener("webglcontextlost", contextLost);
  const resize = new ResizeObserver(() => {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(38 / 2)) *
            Math.max(1, 1.2 / camera.aspect),
        ),
    );
    camera.updateProjectionMatrix();
  });
  resize.observe(host);
  const projected = new THREE.Vector3();
  let visible = true;
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  intersection.observe(host);
  let previousFrame = 0;
  renderer.setAnimationLoop((time) => {
    if (
      disposed ||
      document.hidden ||
      !visible ||
      time - previousFrame < 1000 / 45
    )
      return;
    const delta = Math.min((time - previousFrame) / 1000, 0.1);
    previousFrame = time;
    if (destination) {
      camera.position.lerp(destination.camera, 1 - Math.exp(-delta * 7));
      controls.target.lerp(destination.target, 1 - Math.exp(-delta * 7));
      if (camera.position.distanceTo(destination.camera) < 0.04)
        destination = null;
    }
    controls.update();
    if (compass)
      compass.style.transform = `rotate(${(-controls.getAzimuthalAngle() * 180) / Math.PI - 45}deg)`;
    if (!destination) {
      const targetHeight = heightAt(controls.target.x, controls.target.z);
      camera.position.y += targetHeight - controls.target.y;
      controls.target.y = targetHeight;
    }
    camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + 3);
    camera.updateMatrixWorld();
    if (!reducedMotion) ripples.position.z = Math.sin(time * 0.0005) * 0.5;
    weatherEffects.update(time, delta);
    for (const plot of plots) {
      const action = state.ongoingActions.find((item) => item.parcel_id === plot.id);
      if (!action || !plot.machine || !plot.lane) continue;
      const initial = action.progress_percent / 100;
      const duration = action.remaining_minutes * 60 / Math.max(0.001, 1 - initial);
      const progress = Math.min(1, initial + (reducedMotion ? 0 : (performance.now() - actionSnapshotAt) / 1000 / Math.max(1, duration)));
      const phase = progress * 2;
      const t = phase > 1 ? 2 - phase : phase;
      const [a, b] = plot.lane;
      const x = THREE.MathUtils.lerp(a.x, b.x, t), z = -THREE.MathUtils.lerp(a.y, b.y, t);
      const normal = terrainNormal(heightAt, x, z);
      const forward = new THREE.Vector3(b.x - a.x, 0, a.y - b.y).multiplyScalar(phase > 1 ? -1 : 1);
      forward.addScaledVector(normal, -forward.dot(normal)).normalize();
      const side = new THREE.Vector3().crossVectors(forward, normal).normalize();
      plot.machine.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, normal, side));
      plot.machine.position.set(x, heightAt(x, z) + 0.68, z);
    }
    if (!reducedMotion) {
      for (const plot of plots) {
        plot.weatherDecor.traverse((child) => {
          if (child.userData.weatherFlame)
            child.scale.y = child.userData.baseScaleY * (0.9 + Math.sin(time * 0.012 + plot.id) * 0.15);
          if (child.userData.weatherSmoke) {
            child.position.y += delta * 0.13;
            if (child.position.y > child.userData.baseY + 0.55) child.position.y = child.userData.baseY;
          }
        });
      }
    }
    const occupied: { x: number; y: number }[] = [];
    // Keep markers distinct at every zoom level; selection and owned land get priority.
    const labelOrder = [...plots].sort(
      (a, b) =>
        Number(b.id === state.selectedId) - Number(a.id === state.selectedId) ||
        Number(b.label.dataset.owned === "true") -
          Number(a.label.dataset.owned === "true") ||
        a.id - b.id,
    );
    for (const plot of labelOrder) {
      projected.copy(plot.center).project(camera);
      const shown =
        (state.labels || state.selectedId === plot.id) &&
        plot.label.dataset.matches === "true" &&
        projected.z < 1 &&
        projected.z > -1 &&
        Math.abs(projected.x) < 0.97 &&
        Math.abs(projected.y) < 0.95;
      plot.label.hidden = !shown;
      plot.leader.hidden = true;
      if (shown) {
        const [offsetX, offsetY] = LABEL_SCREEN_OFFSETS[plot.id] ?? [0, 0];
        const x = ((projected.x + 1) / 2) * host.clientWidth + offsetX;
        const y = ((-projected.y + 1) / 2) * host.clientHeight + offsetY;
        const position = placeMarker(
          x,
          y,
          host.clientWidth,
          host.clientHeight,
          occupied,
        );
        if (position) {
          occupied.push(position);
          plot.label.style.transform = `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`;
          const anchorX = ((projected.x + 1) / 2) * host.clientWidth;
          const anchorY = ((-projected.y + 1) / 2) * host.clientHeight;
          const dx = position.x - anchorX, dy = position.y - anchorY;
          if (Math.hypot(dx, dy) > 18) {
            plot.leader.hidden = false;
            plot.leader.style.width = `${Math.hypot(dx, dy)}px`;
            plot.leader.style.transform = `translate(${anchorX}px, ${anchorY}px) rotate(${Math.atan2(dy, dx)}rad)`;
          }
        } else plot.label.hidden = true;
      }
    }
    renderer.render(scene, camera);
  });
  return {
    update(next: SceneState) {
      if (next.ongoingActions !== state.ongoingActions) actionSnapshotAt = performance.now();
      state = next;
      paint();
    },
    command,
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      resize.disconnect();
      intersection.disconnect();
      controls.dispose();
      weatherEffects.dispose();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("keydown", key);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("webglcontextlost", contextLost);
      scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      for (const mat of materials) mat.dispose();
      for (const geo of geometries) geo.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      labelHost.replaceChildren();
    },
  };
}

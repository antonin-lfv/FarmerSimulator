import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PARCEL_PATHS } from "@/data/parcelPaths";
import { WATER_REGIONS } from "@/data/mapDecor";
import type { OngoingAction, Parcel, Weather } from "@/lib/types";
import { isParcelAtRisk } from "@/lib/utils";
import {
  containsPoint,
  fieldColor,
  mapShapes,
  placeMarker,
  seededRandom,
} from "./geometry";

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
  mesh: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
  outline: THREE.LineLoop;
  decor: THREE.Group;
  signature: string;
  points: THREE.Vector2[];
  center: THREE.Vector3;
  label: HTMLButtonElement;
}

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
  host.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "Carte 3D de la ferme. Glisser pour tourner, clic droit pour déplacer, molette pour zoomer. Flèches pour déplacer, plus et moins pour zoomer, R pour recentrer.",
  );
  const scene = new THREE.Scene();
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
  controls.target.set(0, 0, 8);
  controls.update();
  scene.add(new THREE.HemisphereLight("#fff4df", "#769482", 2.7));
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
  const trunkMat = material("#76604a"),
    leafMat = material("#ffffff"),
    cropMat = material("#ffffff");
  const wallMat = material("#eee2c6"),
    roofMat = material("#9c6048"),
    darkMat = material("#566568");
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
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  block(scene, box, material("#b6a58a"), 0, -1.6, 0, 111, 3.2, 111);
  block(scene, box, material("#c5c5a0"), 0, 0, 0, 111, 0.3, 111);
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
    const geo = geometry(
      new THREE.ExtrudeGeometry(shapes, { depth: 0.35, bevelEnabled: false }),
    );
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, material("#afba79"));
    mesh.position.y = 0.18;
    mesh.receiveShadow = true;
    mesh.userData.parcelId = parcelId;
    scene.add(mesh);
    const points = shapes[0].getPoints();
    const borderGeo = geometry(
      new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p.x, 0.6, -p.y)),
      ),
    );
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
    const center = new THREE.Vector3(middle.x, 2.8, -middle.y);
    const decor = new THREE.Group();
    scene.add(decor);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "plot-marker";
    label.textContent = String(parcelId).padStart(2, "0");
    label.setAttribute("aria-label", `Sélectionner la parcelle ${parcelId}`);
    label.addEventListener("click", () => onSelect(parcelId));
    labelHost.appendChild(label);
    plots.push({
      id: parcelId,
      mesh,
      outline,
      decor,
      signature: "",
      points,
      center,
      label,
    });
  }

  function decorate(plot: Plot, parcel: Parcel) {
    // Shared geometry/materials are disposed once with the scene; only instances change here.
    for (const child of [...plot.decor.children]) {
      if (child instanceof THREE.InstancedMesh) child.dispose();
      plot.decor.remove(child);
    }
    const bounds = new THREE.Box2().setFromPoints(plot.points);
    const rand = seededRandom(plot.id * 311);
    if (parcel.type_surface === "entrepôt") {
      const width = Math.min(5, (bounds.max.x - bounds.min.x) * 0.5);
      const depth = Math.min(7, (bounds.max.y - bounds.min.y) * 0.5);
      const { x, z } = plot.center;
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
    if (!positions.length) return;
    const foliage = new THREE.InstancedMesh(
      forest ? cone : box,
      forest ? leafMat : cropMat,
      positions.length,
    );
    const trunks = forest
      ? new THREE.InstancedMesh(cylinder, trunkMat, positions.length)
      : null;
    const dummy = new THREE.Object3D();
    const growth = parcel.planted_seed_name
      ? 0.25 + ((parcel.growth_progress_percent ?? 0) / 100) * 0.7
      : 0.22;
    positions.forEach((pos, i) => {
      const height = forest ? 3.8 * pos.scale : vineyard ? 0.95 : growth;
      dummy.position.set(pos.x, 0.55 + height / 2 + (forest ? 0.7 : 0), pos.z);
      dummy.scale.set(
        forest ? 1.35 * pos.scale : vineyard ? 0.5 : 0.2,
        height,
        forest ? 1.35 * pos.scale : 0.9,
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
              ? "#627941"
              : parcel.planted_seed_name
                ? (parcel.growth_progress_percent ?? 0) > 75
                  ? "#e1bf62"
                  : "#7e9b43"
                : "#a6ad6c",
        ),
      );
      if (trunks) {
        dummy.position.y = 1;
        dummy.scale.set(0.15, 1.3, 0.15);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
      }
    });
    foliage.castShadow = forest || vineyard;
    foliage.receiveShadow = true;
    plot.decor.add(foliage);
    if (trunks) plot.decor.add(trunks);
  }

  let state: SceneState = {
    parcels: [],
    ongoingActions: [],
    selectedId: null,
    filter: "all",
    labels: true,
  };
  let hovered: number | null = null;
  let disposed = false;
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
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
      plot.label.dataset.selected = String(selected);
      plot.label.dataset.owned = String(parcel.is_purchased);
      plot.label.dataset.active = String(active);
      plot.label.dataset.risk = String(risk);
      plot.label.dataset.matches = String(matches);
      plot.label.setAttribute("aria-pressed", String(selected));
      plot.label.title = `Parcelle ${plot.id} · ${parcel.type_surface} · ${parcel.superficie} ha · ${active ? actions.get(plot.id)!.action_type : parcel.is_purchased ? "Possédée" : "À vendre"}${risk ? " · À risque" : ""}`;
      const signature = [
        parcel.type_surface,
        parcel.planted_seed_name,
        Math.floor((parcel.growth_progress_percent ?? 0) / 10),
        parcel.parcel_next_action,
      ].join("|");
      if (plot.signature !== signature) {
        decorate(plot, parcel);
        plot.signature = signature;
      }
    }
    sun.intensity = state.weather === "pluie" ? 1.5 : 3.4;
    sun.color.set(
      state.weather === "gel"
        ? "#e5f4ff"
        : state.weather === "canicule"
          ? "#ffc578"
          : "#fff0d4",
    );
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
        target: new THREE.Vector3(0, 0, 8),
      };
    else if (action === "top")
      destination = {
        camera: controls.target.clone().add(new THREE.Vector3(0, 130, 0.1)),
        target: controls.target.clone(),
      };
    else {
      const plot = plots.find((p) => p.id === state.selectedId);
      if (!plot) return;
      const target = plot.center.clone().setY(0);
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
    if (!reducedMotion) ripples.position.z = Math.sin(time * 0.0005) * 0.5;
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
      if (shown) {
        const x = ((projected.x + 1) / 2) * host.clientWidth;
        const y = ((-projected.y + 1) / 2) * host.clientHeight;
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
        } else plot.label.hidden = true;
      }
    }
    renderer.render(scene, camera);
  });
  return {
    update(next: SceneState) {
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

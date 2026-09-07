import * as THREE from "three";
import type { Weather } from "@/lib/types";
import { seededRandom } from "./geometry";

interface Atmosphere {
  clear: string;
  fogNear: number;
  fogFar: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  sun: string;
  sunIntensity: number;
  exposure: number;
}

const ATMOSPHERES: Record<Weather, Atmosphere> = {
  normal: {
    clear: "#dce5d8",
    fogNear: 230,
    fogFar: 440,
    hemisphereSky: "#fff4df",
    hemisphereGround: "#769482",
    hemisphereIntensity: 2.7,
    sun: "#fff0d4",
    sunIntensity: 3.4,
    exposure: 1.05,
  },
  pluie: {
    clear: "#9caaa4",
    fogNear: 165,
    fogFar: 345,
    hemisphereSky: "#c7d4d5",
    hemisphereGround: "#5f756f",
    hemisphereIntensity: 1.75,
    sun: "#dce8e6",
    sunIntensity: 1.25,
    exposure: 0.92,
  },
  orage: {
    clear: "#59666b",
    fogNear: 145,
    fogFar: 330,
    hemisphereSky: "#83919a",
    hemisphereGround: "#3c4a49",
    hemisphereIntensity: 1.6,
    sun: "#aebbc4",
    sunIntensity: 0.8,
    exposure: 0.98,
  },
  gel: {
    clear: "#dce9ed",
    fogNear: 175,
    fogFar: 360,
    hemisphereSky: "#f3fbff",
    hemisphereGround: "#9aafb1",
    hemisphereIntensity: 2.45,
    sun: "#e5f4ff",
    sunIntensity: 2.35,
    exposure: 1.02,
  },
  canicule: {
    clear: "#ead2a7",
    fogNear: 135,
    fogFar: 300,
    hemisphereSky: "#ffe0a8",
    hemisphereGround: "#aa7e55",
    hemisphereIntensity: 2.25,
    sun: "#ffc578",
    sunIntensity: 4.25,
    exposure: 1.14,
  },
};

export function createWeatherEffects(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  hemisphere: THREE.HemisphereLight,
  sun: THREE.DirectionalLight,
  reducedMotion: boolean,
  heightAt: (x: number, z: number) => number,
) {
  const random = seededRandom(24051994);
  const rainCount = reducedMotion ? 180 : 520;
  const rainPositions = new Float32Array(rainCount * 6);
  const rainSpeeds = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    const offset = i * 6;
    const x = (random() - 0.5) * 150;
    const y = 3 + random() * 92;
    const z = (random() - 0.5) * 150;
    const length = 1.2 + random() * 2.2;
    rainPositions.set([x, y, z, x - 0.35, y - length, z + 0.15], offset);
    rainSpeeds[i] = 34 + random() * 30;
  }
  const rainGeometry = new THREE.BufferGeometry();
  const rainAttribute = new THREE.BufferAttribute(rainPositions, 3);
  rainAttribute.setUsage(THREE.DynamicDrawUsage);
  rainGeometry.setAttribute("position", rainAttribute);
  const rainMaterial = new THREE.LineBasicMaterial({
    color: "#d8eff6",
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.frustumCulled = false;
  rain.renderOrder = 20;
  scene.add(rain);

  const frostCount = reducedMotion ? 80 : 220;
  const frostPositions = new Float32Array(frostCount * 3);
  for (let i = 0; i < frostCount; i++)
    frostPositions.set(
      [(random() - 0.5) * 135, 1 + random() * 24, (random() - 0.5) * 135],
      i * 3,
    );
  const frostGeometry = new THREE.BufferGeometry();
  frostGeometry.setAttribute("position", new THREE.BufferAttribute(frostPositions, 3));
  const frostMaterial = new THREE.PointsMaterial({
    color: "#effcff",
    size: 0.55,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const frost = new THREE.Points(frostGeometry, frostMaterial);
  frost.renderOrder = 19;
  scene.add(frost);

  const heatCount = reducedMotion ? 50 : 140;
  const heatPositions = new Float32Array(heatCount * 3);
  for (let i = 0; i < heatCount; i++)
    heatPositions.set(
      [(random() - 0.5) * 130, 0.8 + random() * 17, (random() - 0.5) * 130],
      i * 3,
    );
  const heatGeometry = new THREE.BufferGeometry();
  heatGeometry.setAttribute("position", new THREE.BufferAttribute(heatPositions, 3));
  const heatMaterial = new THREE.PointsMaterial({
    color: "#ffd48a",
    size: 0.75,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const heat = new THREE.Points(heatGeometry, heatMaterial);
  scene.add(heat);

  const lightning = new THREE.DirectionalLight("#dbe8ff", 0);
  lightning.position.set(35, 85, 20);
  scene.add(lightning);

  const boltGeometry = new THREE.BufferGeometry();
  const boltPositions = new Float32Array(9 * 3);
  boltGeometry.setAttribute("position", new THREE.BufferAttribute(boltPositions, 3));
  const boltMaterial = new THREE.LineBasicMaterial({ color: "#e5eeff", transparent: true, opacity: 0.95, depthWrite: false });
  const bolt = new THREE.Line(boltGeometry, boltMaterial);
  bolt.frustumCulled = false;
  scene.add(bolt);
  let stormCycle = -1;
  const splashGeometry = new THREE.RingGeometry(0.18, 0.25, 12);
  splashGeometry.rotateX(-Math.PI / 2);
  const splashMaterial = new THREE.MeshBasicMaterial({ color: "#d5e9e7", transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const splashes = new THREE.InstancedMesh(splashGeometry, splashMaterial, 70);
  const splashPoints = Array.from({ length: 70 }, () => ({ x: (random() - 0.5) * 108, z: (random() - 0.5) * 108, phase: random() }));
  const splashTransform = new THREE.Object3D();
  scene.add(splashes);

  let weather: Weather = "normal";
  function set(next: Weather | undefined) {
    weather = next ?? "normal";
    const atmosphere = ATMOSPHERES[weather];
    renderer.setClearColor(atmosphere.clear);
    renderer.toneMappingExposure = atmosphere.exposure;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(atmosphere.clear);
      scene.fog.near = atmosphere.fogNear;
      scene.fog.far = atmosphere.fogFar;
    }
    hemisphere.color.set(atmosphere.hemisphereSky);
    hemisphere.groundColor.set(atmosphere.hemisphereGround);
    hemisphere.intensity = atmosphere.hemisphereIntensity;
    sun.color.set(atmosphere.sun);
    sun.intensity = atmosphere.sunIntensity;
    rain.visible = weather === "pluie" || weather === "orage";
    rainMaterial.opacity = weather === "orage" ? 0.74 : 0.52;
    frost.visible = weather === "gel";
    heat.visible = weather === "canicule";
    lightning.visible = weather === "orage";
    bolt.visible = false;
    splashes.visible = rain.visible && !reducedMotion;
    if (weather !== "orage") lightning.intensity = 0;
  }

  function update(time: number, delta: number) {
    if (!reducedMotion && rain.visible) {
      const wind = weather === "orage" ? 15 : 5;
      for (let i = 0; i < rainCount; i++) {
        const offset = i * 6;
        const fall = rainSpeeds[i] * delta;
        for (const vertex of [0, 3]) {
          rainPositions[offset + vertex] += wind * delta;
          rainPositions[offset + vertex + 1] -= fall;
        }
        if (rainPositions[offset + 1] < heightAt(rainPositions[offset], rainPositions[offset + 2]) + 0.6 || rainPositions[offset] > 82) {
          const x = (random() - 0.5) * 150;
          const y = 62 + random() * 35;
          const z = (random() - 0.5) * 150;
          const length = 1.2 + random() * 2.2;
          rainPositions.set([x, y, z, x - 0.35, y - length, z + 0.15], offset);
        }
      }
      rainAttribute.needsUpdate = true;
      splashPoints.forEach((point, i) => {
        const phase = (time * 0.0015 + point.phase) % 1;
        splashTransform.position.set(point.x, heightAt(point.x, point.z) + 0.6, point.z);
        splashTransform.scale.setScalar(0.2 + phase * 3);
        splashTransform.updateMatrix();
        splashes.setMatrixAt(i, splashTransform.matrix);
      });
      splashes.instanceMatrix.needsUpdate = true;
    }
    if (!reducedMotion && frost.visible) {
      frost.rotation.y += delta * 0.025;
      frost.position.y = Math.sin(time * 0.00035) * 0.6;
    }
    if (!reducedMotion && heat.visible) {
      heat.rotation.y -= delta * 0.035;
      heat.position.y = (time * 0.00065) % 4;
    }
    if (weather === "orage" && !reducedMotion) {
      const cycle = Math.floor(time / 6800);
      if (cycle !== stormCycle) {
        stormCycle = cycle;
        const x = (random() - 0.5) * 65, z = (random() - 0.5) * 65;
        const ground = heightAt(x, z) + 1;
        for (let i = 0; i < 9; i++) boltPositions.set([x + (i === 8 ? 0 : (random() - 0.5) * 7), ground + (8 - i) * 8, z + (i === 8 ? 0 : (random() - 0.5) * 3)], i * 3);
        boltGeometry.getAttribute("position").needsUpdate = true;
      }
      const phase = time % 6800;
      const flash = phase < 75 || (phase > 145 && phase < 205);
      lightning.intensity = flash ? (phase < 75 ? 8 : 4.5) : 0;
      bolt.visible = flash;
      renderer.toneMappingExposure = flash ? 1.25 : ATMOSPHERES.orage.exposure;
    }
  }

  set("normal");
  return {
    set,
    update,
    dispose() {
      scene.remove(rain, frost, heat, lightning, bolt, splashes);
      boltGeometry.dispose();
      boltMaterial.dispose();
      splashes.dispose();
      splashGeometry.dispose();
      splashMaterial.dispose();
      rainGeometry.dispose();
      rainMaterial.dispose();
      frostGeometry.dispose();
      frostMaterial.dispose();
      heatGeometry.dispose();
      heatMaterial.dispose();
      lightning.dispose();
    },
  };
}

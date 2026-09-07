"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Move3D, Minus, Plus, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import type { Parcel } from "@/lib/types";
import type { createFarmScene, MapCommand } from "./three/createFarmScene";

const FORESTS = new Set([6, 16, 17, 24, 27, 36, 52, 53]);
const VINEYARDS = new Set([1, 2, 4, 5, 12, 45, 46, 51, 54]);
const WAREHOUSES = new Set([3, 48, 49, 50]);
const OWNED = new Set([7, 8, 17, 24, 48]);

const DEMO_PARCELS: Parcel[] = Array.from({ length: 54 }, (_, index) => {
  const parcelId = index + 1;
  const typeSurface = WAREHOUSES.has(parcelId)
    ? "entrepôt"
    : FORESTS.has(parcelId)
      ? "forêt"
      : VINEYARDS.has(parcelId)
        ? "vigne"
        : "champ";
  const growing = [8, 17, 24].includes(parcelId);
  return {
    parcel_id: parcelId,
    superficie: typeSurface === "entrepôt" ? 4 : 10,
    type_surface: typeSurface,
    prix: typeSurface === "entrepôt" ? 18_000 : 12_000,
    is_purchased: OWNED.has(parcelId),
    parcel_next_action:
      typeSurface === "entrepôt"
        ? null
        : typeSurface === "forêt"
          ? "planter des arbres"
          : typeSurface === "vigne"
            ? "planter des vignes"
            : "labourer",
    previous_action: null,
    yield_health: 100,
    fertilized: false,
    storage_level: typeSurface === "entrepôt" && OWNED.has(parcelId) ? 1 : 0,
    protected_today: false,
    planted_seed_name: growing
      ? typeSurface === "forêt"
        ? "Pousses de chêne"
        : "Graines de blés"
      : null,
    growth_progress_percent: growing ? 68 : null,
    soil_fertility: 100,
  };
});

export function LandingFarmPreview() {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createFarmScene> | null>(null);
  const [parcels, setParcels] = useState(DEMO_PARCELS);
  const parcelsRef = useRef(DEMO_PARCELS);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    parcelsRef.current = parcels;
    scene.current?.update({
      parcels,
      ongoingActions: [],
      selectedId: null,
      weather: "normal",
      filter: "all",
      labels: false,
    });
  }, [parcels]);

  useEffect(() => {
    let cancelled = false;
    api.getParcels().then((liveParcels) => {
      if (!cancelled && liveParcels.length) setParcels(liveParcels);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    import("./three/createFarmScene")
      .then(({ createFarmScene }) => {
        if (cancelled || !host.current || !labelHost.current) return;
        try {
          scene.current = createFarmScene(
            host.current,
            labelHost.current,
            () => router.push("/dashboard"),
            () => setFailed(true),
          );
          scene.current.update({
            parcels: parcelsRef.current,
            ongoingActions: [],
            selectedId: null,
            weather: "normal",
            filter: "all",
            labels: false,
          });
          setReady(true);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [router]);

  function command(action: MapCommand) {
    scene.current?.command(action);
  }

  return (
    <div className="landing-farm-preview farm-viewport">
      <div ref={host} className="farm-canvas" />
      <div ref={labelHost} className="farm-labels" />
      {!ready && !failed && (
        <div className="map-loading" role="status">
          <Move3D size={30} />
          <span>Chargement du domaine 3D…</span>
        </div>
      )}
      {failed && (
        <div className="map-error" role="alert">
          <Move3D size={30} />
          <strong>La preview 3D nécessite l’accélération graphique.</strong>
        </div>
      )}
      {!failed && (
        <>
          <div className="landing-map-hint">
            <Move3D size={15} />
            Glissez pour tourner · Molette pour zoomer
          </div>
          <div className="landing-map-tools" aria-label="Commandes de la preview 3D">
            <button onClick={() => command("in")} aria-label="Zoom avant">
              <Plus size={17} />
            </button>
            <button onClick={() => command("out")} aria-label="Zoom arrière">
              <Minus size={17} />
            </button>
            <button onClick={() => command("home")} aria-label="Recentrer">
              <RotateCcw size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

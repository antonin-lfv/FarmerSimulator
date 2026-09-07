"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  Compass,
  Focus,
  Layers3,
  Maximize,
  Minimize,
  Minus,
  Plus,
  RotateCcw,
  Map,
  MousePointer2,
  X,
  HelpCircle,
  Tag,
} from "lucide-react";
import type { OngoingAction, Parcel, Weather } from "@/lib/types";
import type {
  createFarmScene,
  MapCommand,
  MapFilter,
} from "./three/createFarmScene";

const FarmMap2D = dynamic(
  () => import("./FarmMap2D").then((m) => m.FarmMap2D),
  { ssr: false },
);
interface FarmMapProps {
  parcels: Parcel[];
  ongoingActions: OngoingAction[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  walletBalance?: number;
  showLegend?: boolean;
  weather?: Weather;
}
const FILTERS: { id: MapFilter; label: string }[] = [
  { id: "all", label: "Toutes les parcelles" },
  { id: "owned", label: "Mon exploitation" },
  { id: "sale", label: "À vendre" },
  { id: "active", label: "En activité" },
];

export function FarmMap(props: FarmMapProps) {
  const { onSelect } = props;
  const host = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const compass = useRef<HTMLSpanElement>(null);
  const scene = useRef<ReturnType<typeof createFarmScene> | null>(null);
  const select = useRef(props.onSelect);
  const [filter, setFilter] = useState<MapFilter>("all");
  const [labels, setLabels] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [flat, setFlat] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    select.current = (id) => {
      onSelect(id);
      setExpanded(false);
    };
  }, [onSelect]);
  useEffect(() => {
    if (flat || failed) return;
    let cancelled = false;
    import("./three/createFarmScene")
      .then(({ createFarmScene }) => {
        if (cancelled || !host.current || !labelHost.current) return;
        try {
          scene.current = createFarmScene(
            host.current,
            labelHost.current,
            (id) => select.current(id),
            () => setFailed(true),
            compass.current,
          );
          setReady(true);
        } catch (error) {
          console.error("Unable to initialise farm scene", error);
          host.current.replaceChildren();
          labelHost.current.replaceChildren();
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [flat, failed]);
  useEffect(() => {
    scene.current?.update({ ...props, filter, labels });
  }, [props, filter, labels, ready]);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", escape);
    };
  }, [expanded]);
  function command(action: MapCommand) {
    scene.current?.command(action);
  }
  const fallback = flat || failed;
  return (
    <div className={`farm-viewport ${expanded ? "is-expanded" : ""}`}>
      {fallback ? (
        <div className="farm-flat-map">
          {failed && (
            <p role="status" className="map-fallback-notice">
              La 3D est indisponible sur cet appareil. Le plan 2D reste
              entièrement jouable.
            </p>
          )}
          <FarmMap2D {...props} />
        </div>
      ) : (
        <>
          <div ref={host} className="farm-canvas" />
          <div ref={labelHost} className="farm-labels" />
          {!ready && (
            <div className="map-loading" role="status">
              <Layers3 size={32} />
              <span>Votre ferme prend du relief…</span>
            </div>
          )}
        </>
      )}
      <div className="map-top-controls">
        {!fallback && (
          <div className="map-filters" aria-label="Filtrer la carte">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <div className="map-view-switch">
          <button
            aria-pressed={!fallback}
            onClick={() => {
              if (fallback) {
                setReady(false);
                setFailed(false);
                setFlat(false);
              }
            }}
          >
            <Layers3 size={15} /> 3D
          </button>
          <button aria-pressed={fallback} onClick={() => setFlat(true)}>
            <Map size={15} /> 2D
          </button>
        </div>
      </div>
      {!fallback && (
        <>
          <div className="map-compass">
            <span ref={compass}>
              <Compass size={35} strokeWidth={1.2} />
            </span>
            <span>NORD</span>
          </div>
          <div className="map-tools" aria-label="Commandes de la carte">
            <button
              onClick={() => command("in")}
              title="Zoom avant (+)"
              aria-label="Zoom avant"
            >
              <Plus size={19} />
            </button>
            <button
              onClick={() => command("out")}
              title="Zoom arrière (−)"
              aria-label="Zoom arrière"
            >
              <Minus size={19} />
            </button>
            <span />
            <button
              onClick={() => command("home")}
              title="Recentrer (R)"
              aria-label="Recentrer la carte"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => command("top")}
              title="Vue du dessus"
              aria-label="Vue du dessus"
            >
              <Layers3 size={18} />
            </button>
            <button
              onClick={() => command("focus")}
              disabled={props.selectedId === null}
              title="Centrer sur la sélection"
              aria-label="Centrer sur la sélection"
            >
              <Focus size={19} />
            </button>
            <span />
            <button
              onClick={() => setLabels(!labels)}
              aria-pressed={labels}
              title="Numéros des parcelles"
              aria-label="Afficher les numéros des parcelles"
            >
              <Tag size={18} />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              title={expanded ? "Réduire" : "Agrandir la carte"}
              aria-label={expanded ? "Réduire" : "Agrandir la carte"}
            >
              {expanded ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
          <div className="map-bottom-controls">
            <div className="map-legend">
              <span>
                <i className="owned" /> Vos parcelles
              </span>
              <span>
                <i className="sale" /> À vendre
              </span>
              <span>
                <i className="active" /> En activité
              </span>
              <span>
                <i className="risk" /> À risque
              </span>
            </div>
            <button
              className="map-help-button"
              onClick={() => setHelp(!help)}
              aria-expanded={help}
            >
              <HelpCircle size={16} />
              <span>Commandes</span>
            </button>
          </div>
          {help && (
            <div className="map-help">
              <button onClick={() => setHelp(false)} aria-label="Fermer l’aide">
                <X size={16} />
              </button>
              <h3>Explorez votre domaine</h3>
              <p>Glisser : tourner autour de la ferme</p>
              <p>Clic droit + glisser : déplacer la vue</p>
              <p>Molette / pincement : zoomer</p>
              <p>Tactile : 1 doigt pour tourner, 2 pour déplacer</p>
              <p>Carte au clavier : flèches ou ZQSD / WASD</p>
              <p>+ / − : zoom · R : vue initiale</p>
              <p>Cliquez sur un terrain ou son numéro pour le gérer.</p>
            </div>
          )}
          {props.selectedId === null && (
            <div className="map-invitation">
              <MousePointer2 size={15} /> Cliquez sur une parcelle pour
              commencer
            </div>
          )}
        </>
      )}
      {fallback && expanded && (
        <button
          className="map-flat-close"
          onClick={() => setExpanded(false)}
          aria-label="Réduire"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
}

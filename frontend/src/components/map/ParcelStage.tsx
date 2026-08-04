"use client";

import { useEffect, useRef, useState } from "react";
import { PARCEL_PATHS } from "@/data/parcelPaths";
import { ActionIcon } from "@/components/map/ActionIcon";

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ParcelStage({ parcelId, actionType }: { parcelId: number; actionType: string }) {
  const pathData = PARCEL_PATHS.find((p) => p.parcelId === parcelId)?.d;
  const pathRef = useRef<SVGPathElement>(null);
  const [bbox, setBbox] = useState<BBox | null>(null);

  useEffect(() => {
    if (pathRef.current) {
      const box = pathRef.current.getBBox();
      setBbox({ x: box.x, y: box.y, width: box.width, height: box.height });
    }
  }, [pathData]);

  if (!pathData) return null;

  const pad = bbox ? Math.max(bbox.width, bbox.height) * 0.2 : 0;
  const viewBox = bbox
    ? `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`
    : undefined;

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-sunken">
      <svg viewBox={viewBox} className="h-full w-full">
        <image
          href="/map/map.png"
          x="0"
          y="0"
          width="1097.3333"
          height="1096"
          preserveAspectRatio="xMidYMid slice"
        />
        <path ref={pathRef} d={pathData} fill="rgba(59,146,71,0.32)" stroke="#2c7838" strokeWidth={3} />
      </svg>
      {bbox && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="animate-tractor-sweep absolute top-[46%] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-brand-600/40"
          >
            <ActionIcon actionType={actionType} size={19} className="text-brand-700" strokeWidth={2.2} />
          </div>
        </div>
      )}
    </div>
  );
}

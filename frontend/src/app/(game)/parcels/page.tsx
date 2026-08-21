"use client";

import { useState } from "react";
import { Flame, Layers } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal } from "@/components/ui/Modal";
import { InfoTip } from "@/components/ui/InfoTip";
import { FarmManager } from "@/components/map/FarmManager";
import { ActionGroupsCard } from "@/components/parcels/ActionGroupsCard";
import { usePolledData, useMutationRefresh } from "@/lib/hooks";
import { useCalendar } from "@/lib/calendar-context";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";
import { formatDuration, isParcelAtRisk, isReadyForNextAction, SURFACE_LABELS } from "@/lib/utils";
import type { Parcel } from "@/lib/types";

export default function ParcelsPage() {
  const [openParcelId, setOpenParcelId] = useState<number | null>(null);
  const [protecting, setProtecting] = useState(false);
  const push = useToast();

  const { data: parcels, refresh: refreshParcels } = usePolledData(() => api.getParcels(), 8000);
  const { data: ongoingActions, refresh: refreshActions } = usePolledData(() => api.getOngoingActions(), 2000);
  const { data: catalog, refresh: refreshCatalog } = usePolledData(() => api.getCatalog(), 10000);
  const { calendar } = useCalendar();
  useMutationRefresh(refreshParcels);
  useMutationRefresh(refreshActions);

  const actionByParcel = new Map((ongoingActions ?? []).map((a) => [a.parcel_id, a]));
  // Ready-to-act parcels float to the top, then busy ones, then idle/no next
  // step — with 50+ parcels on a full farm, what needs attention should be
  // visible without scrolling past everything else first.
  function rowPriority(p: Parcel) {
    if (!actionByParcel.has(p.parcel_id) && p.parcel_next_action && isReadyForNextAction(p)) return 0;
    if (actionByParcel.has(p.parcel_id)) return 1;
    if (!actionByParcel.has(p.parcel_id) && p.parcel_next_action) return 2;
    return 3;
  }
  const owned = (parcels ?? [])
    .filter((p) => p.is_purchased)
    .sort((a, b) => rowPriority(a) - rowPriority(b) || a.parcel_id - b.parcel_id);

  const atRisk = owned.filter((p) => isParcelAtRisk(p, calendar?.weather));

  async function handleProtectAll() {
    setProtecting(true);
    try {
      const result = await api.bulkProtect();
      push({
        tone: result.protected > 0 ? "success" : "error",
        title: "Protection groupée",
        description: result.message,
      });
      refreshParcels();
    } finally {
      setProtecting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Parcelles</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Toutes vos parcelles possédées, avec leur état et leurs actions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Layers size={16} className="text-brand-700" />
            Actions groupées
            <InfoTip text="Applique une même action (protection, semis, engrais, récolte...) à toutes les parcelles concernées en un clic, plutôt qu'une par une. Seul le matériel disponible (véhicules, accessoires) peut limiter certaines parcelles — celles-ci seront signalées, relancez l'action groupée une fois le matériel libéré." />
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {atRisk.length > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <div>
                <p className="text-sm font-medium text-red-700">
                  {calendar?.weather_label} aujourd&apos;hui
                </p>
                <p className="mt-0.5 text-xs text-red-700/80">
                  {atRisk.length} parcelle{atRisk.length > 1 ? "s" : ""} exposée
                  {atRisk.length > 1 ? "s" : ""}, non protégée{atRisk.length > 1 ? "s" : ""}.
                </p>
              </div>
              <Button variant="danger" onClick={handleProtectAll} disabled={protecting}>
                <Flame size={14} className="mr-1.5" />
                Protéger toutes ({atRisk.length})
              </Button>
            </div>
          )}

          <ActionGroupsCard
            parcels={parcels ?? []}
            ongoingActions={ongoingActions ?? []}
            catalog={catalog ?? []}
            onRefreshCatalog={refreshCatalog}
            onDone={() => {
              refreshParcels();
              refreshActions();
            }}
          />
        </CardBody>
      </Card>

      {!parcels ? (
        <p className="py-12 text-center text-sm text-foreground-muted">Chargement…</p>
      ) : owned.length === 0 ? (
        <Card className="py-12 text-center text-sm text-foreground-muted">
          Vous ne possédez aucune parcelle pour le moment.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-sunken text-left text-xs font-medium uppercase tracking-wide text-foreground-muted">
              <tr>
                <th className="px-5 py-3">Parcelle</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Superficie</th>
                <th className="px-5 py-3">
                  <span className="flex items-center gap-1">
                    Sol
                    <InfoTip text="Fertilité du champ — baisse si vous replantez la même famille de culture deux cycles de suite, remonte si vous alternez. Ne s'applique qu'aux champs." />
                  </span>
                </th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {owned.map((parcel) => {
                const action = actionByParcel.get(parcel.parcel_id);
                return (
                  <tr key={parcel.parcel_id}>
                    <td className="px-5 py-3 font-medium text-foreground">Parcelle {parcel.parcel_id}</td>
                    <td className="px-5 py-3 text-foreground-secondary">
                      {SURFACE_LABELS[parcel.type_surface] ?? parcel.type_surface}
                    </td>
                    <td className="px-5 py-3 text-foreground-secondary">{parcel.superficie} ha</td>
                    <td className="px-5 py-3">
                      {parcel.type_surface === "champ" ? (
                        <span
                          className={
                            parcel.soil_fertility < 50
                              ? "text-red-600"
                              : parcel.soil_fertility < 100
                                ? "text-amber-600"
                                : "text-brand-700"
                          }
                        >
                          {Math.round(parcel.soil_fertility)}%
                        </span>
                      ) : (
                        <span className="text-foreground-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {action ? (
                        <div className="flex items-center gap-3">
                          <Badge tone="brand">{action.action_type}</Badge>
                          <span className="w-28">
                            <ProgressBar value={action.progress_percent} />
                          </span>
                          <span className="text-xs text-foreground-muted">
                            {formatDuration(action.remaining_minutes * 60)}
                          </span>
                        </div>
                      ) : parcel.parcel_next_action && !isReadyForNextAction(parcel) ? (
                        <div className="flex items-center gap-3">
                          <Badge tone="neutral">En pousse</Badge>
                          <span className="w-28">
                            <ProgressBar value={parcel.growth_progress_percent ?? 0} />
                          </span>
                          <span className="text-xs text-foreground-muted">
                            {Math.round(parcel.growth_progress_percent ?? 0)}%
                          </span>
                        </div>
                      ) : parcel.parcel_next_action ? (
                        <span className="text-foreground-secondary">
                          Prochaine action : <span className="font-medium">{parcel.parcel_next_action}</span>
                        </span>
                      ) : (
                        <span className="text-foreground-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setOpenParcelId(parcel.parcel_id)}>
                        Gérer
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={openParcelId != null}
        onClose={() => setOpenParcelId(null)}
        title={openParcelId ? `Parcelle ${openParcelId}` : undefined}
      >
        {openParcelId != null && <FarmManager initialParcelId={openParcelId} />}
      </Modal>
    </div>
  );
}

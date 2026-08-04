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
import { BulkActionModal } from "@/components/parcels/BulkActionModal";
import { usePolledData, useMutationRefresh } from "@/lib/hooks";
import { useCalendar } from "@/lib/calendar-context";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";
import { formatDuration, GROWING_NEXT_ACTIONS, SURFACE_LABELS } from "@/lib/utils";
import type { ActionRequirement } from "@/lib/types";

interface ActionGroup {
  actionType: string;
  count: number;
  /** Any one matching parcel_id, used to fetch that action's requirements. */
  sampleParcelId: number;
}

export default function ParcelsPage() {
  const [openParcelId, setOpenParcelId] = useState<number | null>(null);
  const [protecting, setProtecting] = useState(false);
  const [bulkGroup, setBulkGroup] = useState<ActionGroup | null>(null);
  const [bulkRequirements, setBulkRequirements] = useState<ActionRequirement[] | null>(null);
  const push = useToast();

  const { data: parcels, refresh: refreshParcels } = usePolledData(() => api.getParcels(), 8000);
  const { data: ongoingActions, refresh: refreshActions } = usePolledData(() => api.getOngoingActions(), 2000);
  const { data: workers } = usePolledData(() => api.getWorkers(), 15000);
  const { data: catalog, refresh: refreshCatalog } = usePolledData(() => api.getCatalog(), 10000);
  const { calendar } = useCalendar();
  useMutationRefresh(refreshParcels);
  useMutationRefresh(refreshActions);

  const owned = (parcels ?? []).filter((p) => p.is_purchased).sort((a, b) => a.parcel_id - b.parcel_id);
  const actionByParcel = new Map((ongoingActions ?? []).map((a) => [a.parcel_id, a]));

  const isDangerWeather = calendar?.weather === "gel" || calendar?.weather === "canicule";
  const atRisk = owned.filter(
    (p) =>
      p.type_surface !== "entrepôt" &&
      p.parcel_next_action != null &&
      GROWING_NEXT_ACTIONS.has(p.parcel_next_action) &&
      !p.protected_today &&
      isDangerWeather,
  );

  const groupMap = new Map<string, ActionGroup>();
  for (const parcel of owned) {
    if (!parcel.parcel_next_action || actionByParcel.has(parcel.parcel_id)) continue;
    const existing = groupMap.get(parcel.parcel_next_action);
    if (existing) {
      existing.count += 1;
    } else {
      groupMap.set(parcel.parcel_next_action, {
        actionType: parcel.parcel_next_action,
        count: 1,
        sampleParcelId: parcel.parcel_id,
      });
    }
  }
  const groups = [...groupMap.values()].sort((a, b) => b.count - a.count);

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

  async function openBulkModal(group: ActionGroup) {
    setBulkGroup(group);
    const detail = await api.getParcel(group.sampleParcelId);
    setBulkRequirements(detail.possible_actions[0]?.requirements ?? []);
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
            <InfoTip text="Applique une même action (protection, semis, engrais, récolte...) à toutes les parcelles concernées en un clic, plutôt qu'une par une. Limité par le nombre d'ouvriers libres — relancez plus tard pour traiter le reste." />
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

          {groups.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              Aucune action groupée disponible pour le moment — toutes vos parcelles sont soit en cours
              d&apos;action, soit sans étape suivante.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {groups.map((group) => (
                <div key={group.actionType} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium capitalize text-foreground">{group.actionType}</p>
                    <p className="text-xs text-foreground-muted">
                      {group.count} parcelle{group.count > 1 ? "s" : ""} prête{group.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openBulkModal(group)}>
                    Lancer sur toutes
                  </Button>
                </div>
              ))}
            </div>
          )}
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

      {bulkGroup && bulkRequirements && (
        <BulkActionModal
          open
          onClose={() => {
            setBulkGroup(null);
            setBulkRequirements(null);
          }}
          actionType={bulkGroup.actionType}
          eligibleCount={bulkGroup.count}
          requirements={bulkRequirements}
          catalog={catalog ?? []}
          workers={workers ?? []}
          onRefreshCatalog={refreshCatalog}
          onDone={() => {
            refreshParcels();
            refreshActions();
          }}
        />
      )}
    </div>
  );
}

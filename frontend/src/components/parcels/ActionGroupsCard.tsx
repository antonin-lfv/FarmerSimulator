"use client";

import { useState } from "react";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { InfoTip } from "@/components/ui/InfoTip";
import { BulkActionModal } from "@/components/parcels/BulkActionModal";
import { api } from "@/lib/api";
import { groupGrowingParcels, groupPendingActions, type ActionGroup } from "@/lib/utils";
import type { ActionRequirement, CatalogItem, OngoingAction, Parcel } from "@/lib/types";

/**
 * The "what needs doing across the whole farm" list — every owned, idle,
 * actionable parcel clustered by its next action, each with a one-click bulk
 * launch. Shared between /parcels (full page) and the dashboard's compact
 * to-do widget so a 54-parcel farm doesn't require opening each one to see
 * what's pending.
 */
export function ActionGroupsCard({
  parcels,
  ongoingActions,
  catalog,
  onRefreshCatalog,
  onDone,
  emptyMessage = "Aucune action groupée disponible pour le moment — toutes vos parcelles sont soit en cours d'action, soit sans étape suivante.",
}: {
  parcels: Parcel[];
  ongoingActions: OngoingAction[];
  catalog: CatalogItem[];
  onRefreshCatalog: () => Promise<void>;
  onDone: () => void;
  emptyMessage?: string;
}) {
  const [bulkGroup, setBulkGroup] = useState<ActionGroup | null>(null);
  const [bulkRequirements, setBulkRequirements] = useState<ActionRequirement[] | null>(null);

  const groups = groupPendingActions(parcels, ongoingActions);
  const growingGroups = groupGrowingParcels(parcels, ongoingActions);

  async function openBulkModal(group: ActionGroup) {
    setBulkGroup(group);
    const detail = await api.getParcel(group.sampleParcelId);
    setBulkRequirements(detail.possible_actions[0]?.requirements ?? []);
  }

  return (
    <>
      {groups.length === 0 && growingGroups.length === 0 ? (
        <p className="text-sm text-foreground-muted">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.length > 0 && (
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

          {growingGroups.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <Sprout size={13} />
                En pousse — pas encore prêtes
                <InfoTip text="La récolte de ces parcelles n'est pas encore possible : la jauge de pousse doit atteindre 100% avant de pouvoir lancer l'action. Rien à faire pour l'instant, juste patienter." />
              </p>
              <div className="flex flex-col divide-y divide-border">
                {growingGroups.map((group) => (
                  <div key={group.actionType} className="flex items-center gap-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize text-foreground">{group.actionType}</p>
                      <p className="text-xs text-foreground-muted">
                        {group.count} parcelle{group.count > 1 ? "s" : ""} — pousse moyenne{" "}
                        {Math.round(group.avgProgress)}%
                      </p>
                      <div className="mt-1.5 max-w-40">
                        <ProgressBar value={group.avgProgress} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
          catalog={catalog}
          onRefreshCatalog={onRefreshCatalog}
          onDone={onDone}
        />
      )}
    </>
  );
}

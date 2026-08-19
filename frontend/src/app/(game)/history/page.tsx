"use client";

import { History, Wallet, Clock, Sprout } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { usePolledData, useMutationRefresh } from "@/lib/hooks";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/utils";

export default function HistoryPage() {
  const { data: history, refresh } = usePolledData(() => api.getActionHistory(200), 10000);
  useMutationRefresh(refresh);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Historique des activités</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Chaque activité terminée sur l&apos;exploitation, la plus récente en premier.
        </p>
      </div>

      <Card>
        {!history ? (
          <CardBody className="text-sm text-foreground-muted">Chargement…</CardBody>
        ) : history.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-10 text-center text-sm text-foreground-muted">
            <History size={24} className="text-foreground-muted/50" />
            Aucune activité terminée pour l&apos;instant.
          </CardBody>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((entry) => (
              <li key={entry.action_history_id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Sprout size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize text-foreground">
                    {entry.action_type} — parcelle {entry.parcel_id}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-foreground-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {Math.round(entry.duration_minutes)} min · {entry.superficie} ha
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Wallet size={14} className="text-foreground-muted" />
                  {formatUsd(entry.cost)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

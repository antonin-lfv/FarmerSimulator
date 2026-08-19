"use client";

import { useState } from "react";
import { Receipt, ArrowDownRight, ArrowUpRight, FileText } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { usePolledData, useMutationRefresh } from "@/lib/hooks";
import { api } from "@/lib/api";
import { cn, formatUsd, TRANSACTION_CATEGORY_LABELS } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

const CATEGORY_OPTIONS = Object.entries(TRANSACTION_CATEGORY_LABELS);

export default function InvoicesPage() {
  const [category, setCategory] = useState("");
  const { data: transactions, refresh } = usePolledData(
    () => api.getTransactions({ limit: 200, category: category || undefined }),
    10000,
  );
  useMutationRefresh(refresh);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const income = transactions?.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0) ?? 0;
  const expense = transactions?.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0) ?? 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Factures & trésorerie</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Chaque euro qui entre ou qui sort, avec le détail — les gros achats de matériel génèrent
            une vraie facture numérotée.
          </p>
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-56">
          <option value="">Toutes les catégories</option>
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardBody className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ArrowUpRight size={16} />
            </span>
            <div>
              <p className="text-xs font-medium text-foreground-secondary">Entrées affichées</p>
              <p className="text-lg font-semibold text-foreground">{formatUsd(income)}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-700">
              <ArrowDownRight size={16} />
            </span>
            <div>
              <p className="text-xs font-medium text-foreground-secondary">Sorties affichées</p>
              <p className="text-lg font-semibold text-foreground">{formatUsd(expense)}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        {!transactions ? (
          <CardBody className="text-sm text-foreground-muted">Chargement…</CardBody>
        ) : transactions.length === 0 ? (
          <CardBody className="text-sm text-foreground-muted">Aucune transaction pour l&apos;instant.</CardBody>
        ) : (
          <ul className="divide-y divide-border">
            {transactions.map((t) => (
              <li key={t.transaction_id}>
                <button
                  type="button"
                  onClick={() => t.is_invoice && setSelected(t)}
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors",
                    t.is_invoice ? "cursor-pointer hover:bg-surface-sunken" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      t.amount >= 0 ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700",
                    )}
                  >
                    {t.is_invoice ? (
                      <Receipt size={16} />
                    ) : t.amount >= 0 ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{t.label}</p>
                      {t.is_invoice && (
                        <Badge tone="brand" className="shrink-0">
                          {t.invoice_number}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-foreground-muted">
                      {TRANSACTION_CATEGORY_LABELS[t.category] ?? t.category} · {t.date_label}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-sm font-semibold", t.amount >= 0 ? "text-brand-700" : "text-red-700")}>
                      {t.amount >= 0 ? "+" : ""}
                      {formatUsd(t.amount)}
                    </p>
                    <p className="text-xs text-foreground-muted">solde {formatUsd(t.balance_after)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Facture" className="max-w-md">
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <FileText size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.invoice_number}</p>
                  <p className="text-xs text-foreground-muted">{selected.date_label}</p>
                </div>
              </div>
              <Badge tone="neutral">{TRANSACTION_CATEGORY_LABELS[selected.category] ?? selected.category}</Badge>
            </div>

            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <span>Article</span>
                <span>Total</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{selected.item_name}</p>
                  {selected.quantity != null && selected.unit_price != null && (
                    <p className="text-xs text-foreground-muted">
                      {selected.quantity} × {formatUsd(selected.unit_price)}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground">{formatUsd(Math.abs(selected.amount))}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border bg-surface-sunken px-4 py-3">
                <span className="text-sm font-semibold text-foreground">Total payé</span>
                <span className="text-lg font-semibold text-foreground">{formatUsd(Math.abs(selected.amount))}</span>
              </div>
            </div>

            <p className="text-xs text-foreground-muted">
              Solde de trésorerie après cette opération : {formatUsd(selected.balance_after)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

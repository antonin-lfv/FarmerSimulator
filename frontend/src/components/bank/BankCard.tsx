"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";

export function BankCard() {
  const { data: loans, refresh: refreshLoans } = usePolledData(() => api.getLoans(), 8000);
  const [amount, setAmount] = useState("50000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const push = useToast();

  const loan = loans?.[0] ?? null;

  async function handleBorrow() {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.borrow(value);
      if (result.success) {
        push({ tone: "success", title: "Prêt accordé", description: `${formatUsd(value)} crédités sur votre compte.` });
        await refreshLoans();
      } else {
        setError(result.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRepay() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.repayLoan();
      if (result.success) {
        push({ tone: "success", title: "Prêt remboursé" });
        await refreshLoans();
      } else {
        setError(result.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Banque</CardTitle>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Landmark size={14} />
        </span>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {loan ? (
          <>
            <div className="rounded-lg border border-border bg-surface-sunken p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Capital restant dû</span>
                <span className="font-semibold text-foreground">{formatUsd(loan.balance_owed)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-foreground-muted">
                <span className="flex items-center gap-1">
                  Mensualité
                  <InfoTip
                    text="Prélevée automatiquement sur votre trésorerie tous les 30 jours de jeu (intérêt + capital). Si le solde est insuffisant le jour du prélèvement, l'échéance est notée impayée."
                    size={11}
                  />
                </span>
                <span>{formatUsd(loan.monthly_payment)} / mois</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-foreground-muted">
                <span>Taux</span>
                <span>{(loan.interest_rate_annual * 100).toFixed(0)}% / an sur {loan.term_months} mois</span>
              </div>
            </div>
            <Button size="sm" variant="secondary" disabled={busy} onClick={handleRepay}>
              Rembourser intégralement
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-foreground-muted">
              Un seul prêt actif à la fois, remboursé par mensualités automatiques.
            </p>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={0}
                step={5000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
              />
              <Button size="sm" onClick={handleBorrow} disabled={busy}>
                Emprunter
              </Button>
            </div>
          </>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardBody>
    </Card>
  );
}

"use client";

import { Wallet, Sprout } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { usePolledData } from "@/lib/hooks";
import { api } from "@/lib/api";
import { formatUsd } from "@/lib/utils";

export default function AccountPage() {
  const { data: wallet } = usePolledData(() => api.getWallet(), 5000);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Compte</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Votre exploitation, en un coup d&apos;œil.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trésorerie</CardTitle>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Wallet size={16} />
          </span>
        </CardHeader>
        <CardBody className="flex items-center justify-between">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {wallet ? formatUsd(wallet.balance_usd) : "…"}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exploitation</CardTitle>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Sprout size={16} />
          </span>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-foreground-secondary">
            Verdance est un jeu mono-joueur : un seul portefeuille, une seule exploitation. La gestion
            de plusieurs profils n&apos;est pas prévue pour l&apos;instant.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

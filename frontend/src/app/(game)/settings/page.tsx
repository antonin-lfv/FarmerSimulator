"use client";

import { useEffect, useState } from "react";
import { Bell, Snowflake, Flame, Landmark } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { InfoTip } from "@/components/ui/InfoTip";
import { useToast } from "@/components/ui/ToastProvider";
import { api } from "@/lib/api";
import type { NotificationSettings } from "@/lib/types";

const TOGGLES: {
  key: keyof NotificationSettings;
  label: string;
  description: string;
  icon: typeof Snowflake;
  infoTip?: string;
}[] = [
  {
    key: "gel_alerts",
    label: "Alertes gel",
    description: "Notification à chaque jour de gel, quand vos cultures sont exposées.",
    icon: Snowflake,
  },
  {
    key: "canicule_alerts",
    label: "Alertes canicule",
    description: "Notification à chaque jour de canicule, quand vos cultures sont exposées.",
    icon: Flame,
  },
  {
    key: "bank_alerts",
    label: "Alertes banque",
    description: "Prêt accordé, mensualité prélevée, prêt remboursé.",
    icon: Landmark,
    infoTip: "Désactiver n'annule aucun prélèvement — seule la notification qui vous en informe est coupée.",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [pending, setPending] = useState<keyof NotificationSettings | null>(null);
  const push = useToast();

  useEffect(() => {
    api.getNotificationSettings().then(setSettings);
  }, []);

  async function handleToggle(key: keyof NotificationSettings, value: boolean) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value });
    setPending(key);
    try {
      const updated = await api.updateNotificationSettings({ [key]: value });
      setSettings(updated);
    } catch {
      setSettings(previous);
      push({ tone: "error", title: "Échec de la mise à jour", description: "Réessayez dans un instant." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Paramètres</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Réglages de la partie et de l&apos;affichage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={16} className="text-brand-700" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-1">
          {!settings ? (
            <p className="py-6 text-center text-sm text-foreground-muted">Chargement…</p>
          ) : (
            TOGGLES.map(({ key, label, description, icon: Icon, infoTip }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <Icon size={15} />
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {label}
                      {infoTip && <InfoTip text={infoTip} />}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground-muted">{description}</p>
                  </div>
                </div>
                <Switch
                  checked={settings[key]}
                  disabled={pending === key}
                  onChange={(value) => handleToggle(key, value)}
                  label={label}
                />
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="max-w-sm text-sm text-foreground-muted">
            Difficulté, rappel des règles du jeu, autres préférences d&apos;affichage — à venir dans une prochaine
            mise à jour.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

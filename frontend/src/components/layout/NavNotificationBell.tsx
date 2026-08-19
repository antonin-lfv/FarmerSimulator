"use client";

import { useRef, useState } from "react";
import { Bell, Landmark, Snowflake, Flame } from "lucide-react";
import { usePolledData, useMutationRefresh, useClickOutside } from "@/lib/hooks";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, typeof Bell> = {
  bank: Landmark,
  gel: Snowflake,
  canicule: Flame,
};

export function NavNotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { data, refresh } = usePolledData(() => api.getNotifications(), 15000);
  useMutationRefresh(refresh);

  useClickOutside(rootRef, () => setOpen(false), { escape: true });

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && data && data.unread_count > 0) {
      await api.markNotificationsRead();
      await refresh();
    }
  }

  const unread = data?.unread_count ?? 0;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        aria-expanded={open}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors",
          open ? "bg-white/20 text-white" : "text-white/85 hover:bg-white/10 hover:text-white",
        )}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-brand-900" />
        )}
      </button>

      {open && (
        <div className="animate-scale-in absolute right-0 top-14 z-30 max-h-96 w-80 origin-top-right overflow-y-auto rounded-xl border border-border bg-white p-1.5 shadow-xl">
          {!data || data.notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-foreground-muted">
              Aucune notification pour le moment.
            </p>
          ) : (
            data.notifications.map((n) => {
              const Icon = CATEGORY_ICONS[n.category] ?? Bell;
              return (
                <div key={n.notification_id} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <Icon size={13} />
                  </span>
                  <div>
                    <p className="text-sm text-foreground-secondary">{n.message}</p>
                    <p className="mt-0.5 text-xs text-foreground-muted">{n.date_label}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

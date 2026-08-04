"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const ToastContext = createContext<((toast: Omit<Toast, "id">) => void) | null>(null);

const ICONS: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "text-brand-700",
  error: "text-red-600",
  info: "text-foreground-secondary",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++idRef.current;
    setToasts((cur) => [...cur, { ...toast, id }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              className="animate-slide-in-right pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border bg-white p-3 shadow-lg"
            >
              <Icon size={18} className={cn("mt-0.5 shrink-0", TONE_CLASSES[toast.tone])} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs text-foreground-muted">{toast.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used within a ToastProvider");
  return push;
}

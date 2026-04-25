"use client";

import { useEffect, useState, useTransition } from "react";
import { Timer } from "lucide-react";
import { addOrderHour } from "@/app/dashboard/ordre/actions";

type Props = { orderId: string };

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function HourTimer({ orderId }: Props) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPending, startTransition] = useTransition();
  const storageKey = `ampex-timer-${orderId}`;

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const t = Number(raw);
      if (Number.isFinite(t) && t > 0) setStartTime(t);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  function handleStart() {
    const now = Date.now();
    localStorage.setItem(storageKey, String(now));
    setStartTime(now);
  }

  function handleStop() {
    if (!startTime) return;
    const minutes = Math.max(1, Math.round((Date.now() - startTime) / 60_000));
    localStorage.removeItem(storageKey);
    setStartTime(null);
    setElapsed(0);
    const fd = new FormData();
    fd.set("order_id", orderId);
    fd.set("work_date", new Date().toISOString().split("T")[0]);
    fd.set("minutes", String(minutes));
    startTransition(() => {
      void addOrderHour(fd);
    });
  }

  function handleReset() {
    localStorage.removeItem(storageKey);
    setStartTime(null);
    setElapsed(0);
  }

  const staleHours = elapsed > 12 * 3600;

  if (startTime) {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
          staleHours
            ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
            : "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
        }`}
      >
        <Timer className={`size-4 shrink-0 ${staleHours ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} />
        <span
          className={`font-mono text-xl font-semibold tabular-nums ${
            staleHours ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {formatElapsed(elapsed)}
        </span>
        {staleHours && (
          <span className="text-xs text-amber-700 dark:text-amber-300">Timer ser lang ut — sjekk startpunkt</span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={isPending}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 ${
              staleHours ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isPending ? "Lagrer…" : "Stopp og logg"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStart}
      className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted"
    >
      <Timer className="size-4 text-muted-foreground" />
      Start stoppeklokke
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { adjustItemQuantity } from "@/app/dashboard/lager/actions";

type Props = {
  warehouseId: string;
  itemId: string;
  initialQuantity: number;
  unit: string;
};

export function QuickAdjust({ warehouseId, itemId, initialQuantity, unit }: Props) {
  const [qty, setQty] = useState(initialQuantity);
  const [pending, startTransition] = useTransition();

  function adjust(delta: number) {
    if (pending) return;
    const optimistic = Math.max(0, qty + delta);
    setQty(optimistic);
    startTransition(async () => {
      const res = await adjustItemQuantity(warehouseId, itemId, delta);
      if (res.ok) {
        setQty(res.newQuantity);
      } else {
        setQty(qty);
      }
    });
  }

  const colorClass =
    qty <= 0
      ? "text-red-600 dark:text-red-400 font-semibold"
      : qty <= 5
      ? "text-amber-600 dark:text-amber-400 font-semibold"
      : "";

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={pending || qty <= 0}
        aria-label="Reduser antall"
        className="flex h-6 w-6 items-center justify-center rounded border border-input bg-background text-sm font-bold leading-none text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
      >
        −
      </button>
      <span className={`min-w-[3rem] text-center tabular-nums ${colorClass}`}>
        {qty} {unit}
      </span>
      <button
        type="button"
        onClick={() => adjust(1)}
        disabled={pending}
        aria-label="Øk antall"
        className="flex h-6 w-6 items-center justify-center rounded border border-input bg-background text-sm font-bold leading-none text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
      >
        +
      </button>
    </span>
  );
}

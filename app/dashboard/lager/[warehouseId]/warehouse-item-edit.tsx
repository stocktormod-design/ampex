"use client";

import { useState, useTransition } from "react";
import { updateWarehouseItem } from "@/app/dashboard/lager/actions";

export type WarehouseItemRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  barcodes: string[];
};

type Props = {
  warehouseId: string;
  item: WarehouseItemRow;
};

export function WarehouseItemEdit({ warehouseId, item }: Props) {
  const [open, setOpen] = useState(false);
  const [barcodeLines, setBarcodeLines] = useState<string[]>([""]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState("stk");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setBarcodeLines(item.barcodes.length > 0 ? [...item.barcodes] : [""]);
    setName(item.name);
    setQuantity(item.quantity);
    setUnit(item.unit || "stk");
    setError(null);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setError(null);
  }

  function addBarcodeLine() {
    setBarcodeLines((prev) => [...prev, ""]);
  }

  function removeBarcodeLine(index: number) {
    setBarcodeLines((prev) => (prev.length <= 1 ? [""] : prev.filter((_, i) => i !== index)));
  }

  function setBarcodeLine(index: number, value: string) {
    setBarcodeLines((prev) => prev.map((line, i) => (i === index ? value : line)));
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateWarehouseItem(warehouseId, item.id, {
        barcodes: barcodeLines,
        name,
        quantity,
        unit,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      closeDialog();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
      >
        Rediger
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Rediger ${item.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Rediger vare</h2>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Lukk
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Flere strekkoder per vare (f.eks. eske og innholdspakke). Samme kode kan ikke brukes på
              to ulike varer i samme lager. Nye varer registreres i skjemaet over.
            </p>

            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <span className="text-xs font-medium">Strekkoder</span>
                <ul className="space-y-2">
                  {barcodeLines.map((line, index) => (
                    <li key={index} className="flex gap-2">
                      <input
                        value={line}
                        onChange={(e) => setBarcodeLine(index, e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                        placeholder="7080001234567"
                        autoComplete="off"
                        aria-label={`Strekkode ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeBarcodeLine(index)}
                        className="shrink-0 rounded-lg border border-input px-2 py-1 text-xs font-medium hover:bg-muted"
                      >
                        Fjern
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={addBarcodeLine}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Legg til strekkode
                </button>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`edit-name-${item.id}`} className="text-xs font-medium">
                  Navn
                </label>
                <input
                  id={`edit-name-${item.id}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor={`edit-qty-${item.id}`} className="text-xs font-medium">
                    Antall
                  </label>
                  <input
                    id={`edit-qty-${item.id}`}
                    type="number"
                    min={0}
                    step={1}
                    value={quantity}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setQuantity(Number.isFinite(v) ? Math.max(0, v) : 0);
                    }}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`edit-unit-${item.id}`} className="text-xs font-medium">
                    Enhet
                  </label>
                  <input
                    id={`edit-unit-${item.id}`}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    placeholder="stk"
                  />
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className="h-10 rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={pending || !name.trim()}
                onClick={onSave}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

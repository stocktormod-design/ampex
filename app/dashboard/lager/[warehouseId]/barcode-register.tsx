"use client";

import { useState, useTransition } from "react";
import { lookupBarcode, registerWarehouseItem } from "@/app/dashboard/lager/actions";

type Props = {
  warehouseId: string;
};

export function BarcodeRegister({ warehouseId }: Props) {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"idle" | "new" | "found">("idle");
  const [foundName, setFoundName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onLookup() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await lookupBarcode(warehouseId, barcode);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.found) {
        setFoundName(res.name);
        setStep("found");
        setMessage(null);
      } else {
        setFoundName(null);
        setStep("new");
        setMessage("Strekkoden er ny. Fyll inn varenavn og lagre.");
      }
    });
  }

  function onRegister() {
    setError(null);
    startTransition(async () => {
      const savedName = name.trim();
      const res = await registerWarehouseItem(warehouseId, barcode, name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBarcode("");
      setName("");
      setStep("idle");
      setFoundName(null);
      setError(null);
      setMessage(`«${savedName}» er registrert med denne strekkoden.`);
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-base font-semibold">Registrer vare med strekkode</h2>
      <p className="text-xs text-muted-foreground">
        Skann eller lim inn strekkode, trykk «Sjekk». Finnes den ikke, fyll inn navn og lagre — neste gang gjenkjennes
        den automatisk.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor="bc-scan" className="text-xs font-medium">
            Strekkode
          </label>
          <input
            id="bc-scan"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm"
            placeholder="7080001234567"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          disabled={pending || !barcode.trim()}
          onClick={onLookup}
          className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Sjekk strekkode
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{message}</p>
      ) : null}

      {step === "found" && foundName ? (
        <p className="text-sm">
          <span className="font-medium text-foreground">Allerede registrert:</span> {foundName}
        </p>
      ) : null}

      {step === "new" ? (
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <label htmlFor="bc-name" className="text-xs font-medium">
              Varenavn
            </label>
            <input
              id="bc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              placeholder="Skrue M6 rustfri"
            />
          </div>
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={onRegister}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Lagre vare
          </button>
        </div>
      ) : null}
    </div>
  );
}

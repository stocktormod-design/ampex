"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { lookupBarcode, registerWarehouseItem } from "@/app/dashboard/lager/actions";

/** Vanlige 1D-strekkoder (ikke QR / 2D). */
const LINEAR_BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.RSS_14,
  Html5QrcodeSupportedFormats.RSS_EXPANDED,
];

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [readerId] = useState(() => `ampex-bc-${Math.random().toString(36).slice(2, 11)}`);

  const applyLookupResult = useCallback((res: Awaited<ReturnType<typeof lookupBarcode>>) => {
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
  }, []);

  const runLookupForCode = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setError(null);
      setMessage(null);
      startTransition(async () => {
        const res = await lookupBarcode(warehouseId, trimmed);
        applyLookupResult(res);
      });
    },
    [warehouseId, applyLookupResult],
  );

  useEffect(() => {
    if (!cameraOpen) {
      return;
    }

    let cancelled = false;

    const start = async () => {
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled) return;

      try {
        const scanner = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: LINEAR_BARCODE_FORMATS,
          useBarCodeDetectorIfSupported: true,
        });
        scannerRef.current = scanner;
        const viewW = typeof window !== "undefined" ? Math.min(340, window.innerWidth - 48) : 300;
        const viewH = 120;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: viewW, height: viewH },
            aspectRatio: viewW / viewH,
          },
          (decodedText) => {
            if (cancelled) return;
            cancelled = true;
            const text = decodedText.trim();
            setBarcode(text);
            setCameraOpen(false);
            void scanner
              .stop()
              .then(() => scanner.clear())
              .catch(() => {});
            scannerRef.current = null;
            if (text) {
              runLookupForCode(text);
            }
          },
          () => {},
        );
      } catch (e) {
        if (!cancelled) {
          setCameraError(e instanceof Error ? e.message : "Kunne ikke starte kamera");
          setCameraOpen(false);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        void s
          .stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, [cameraOpen, readerId, runLookupForCode]);

  function onLookup() {
    runLookupForCode(barcode);
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

  function closeCamera() {
    setCameraOpen(false);
    setCameraError(null);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-base font-semibold">Registrer vare med strekkode</h2>
      <p className="text-xs text-muted-foreground">
        Skriv eller lim inn strekkode og trykk «Sjekk strekkode», eller bruk kamera (sjekker
        automatisk etter skann). Eksisterende varer finner du i tabellen under — der kan du legge
        inn flere strekkoder per vare (f.eks. eske og innhold). Ved ny kode: fyll inn varenavn og
        lagre.
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
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              setCameraOpen(true);
            }}
            className="h-10 rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            Skann strekkode
          </button>
          <button
            type="button"
            disabled={pending || !barcode.trim()}
            onClick={onLookup}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Sjekk strekkode
          </button>
        </div>
      </div>

      {cameraError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {cameraError}
        </p>
      ) : null}

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

      {cameraOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Strekkodeskanner"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCamera();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Pek kameraet mot strekkoden</p>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Lukk
              </button>
            </div>
            <div id={readerId} className="mt-3 min-h-[200px] overflow-hidden rounded-lg bg-black" />
            <p className="mt-2 text-xs text-muted-foreground">
              Hold strekkoden horisontalt innenfor rammen. Krever HTTPS (produksjon) eller
              localhost. På iPhone: tillat kamera for nettleseren.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

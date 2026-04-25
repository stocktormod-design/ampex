"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { publishOverlayItem } from "@/app/dashboard/projects/actions";
import { PaintCanvas } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-canvas";
import { PaintToolbar } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-toolbar";
import type {
  DetectorChecklist,
  PointChecklist,
  OverlayItem,
  OverlayLayer,
  OverlayVisibility,
  PublishedOverlay,
  ToolId,
} from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type Props = {
  drawingId: string;
  currentUserId: string;
  fileUrl: string;
  filePath: string;
  drawingName: string;
  initialPublished: PublishedOverlay[];
};

const LAYER_COLORS = ["#ef4444", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2"];
const TOOL_KEY_BINDINGS: Record<string, ToolId> = {
  "1": "select",
  "2": "detector",
  "3": "point",
  "4": "line",
  "5": "rect",
  "6": "text",
  "7": "erase",
};
const PANEL_AUTO_OPEN_TOOLS = new Set<ToolId>(["select", "detector", "point"]);
const BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
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

function newLayer(index: number): OverlayLayer {
  return {
    id: crypto.randomUUID(),
    name: `Lag ${index}`,
    visible: true,
    color: LAYER_COLORS[(index - 1) % LAYER_COLORS.length],
    items: [],
  };
}

type DraftPublishRow = {
  item: OverlayItem;
  layerId: string;
  layerName: string;
  layerColor: string;
  indexInLayer: number;
  localKey: string;
};

function isOverlayItem(value: unknown): value is OverlayItem {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown };
  return v.type === "detector" || v.type === "point" || v.type === "line" || v.type === "rect" || v.type === "text";
}

function toChecklist(value?: DetectorChecklist): DetectorChecklist {
  const v = (value ?? {}) as Partial<DetectorChecklist>;
  return {
    baseMounted: Boolean(v.baseMounted),
    detectorMounted: Boolean(v.detectorMounted),
    capOn: v.capOn === "yes" || v.capOn === "no" ? v.capOn : null,
    comment: typeof v.comment === "string" ? v.comment : "",
    serialNumber: typeof v.serialNumber === "string" ? v.serialNumber : "",
    photoDataUrl: typeof v.photoDataUrl === "string" ? v.photoDataUrl : null,
    photoPath: typeof v.photoPath === "string" ? v.photoPath : null,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null,
  };
}

function toPointChecklist(value?: PointChecklist): PointChecklist {
  const v = (value ?? {}) as Partial<PointChecklist>;
  return {
    comment: typeof v.comment === "string" ? v.comment : "",
    photoDataUrl: typeof v.photoDataUrl === "string" ? v.photoDataUrl : null,
    photoPath: typeof v.photoPath === "string" ? v.photoPath : null,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null,
  };
}

function NeonCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-all active:scale-[0.99] ${
        checked
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-background hover:bg-muted/40"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
          checked
            ? "border-primary bg-primary/15"
            : "border-border bg-muted"
        }`}
      >
        {checked && (
          <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </label>
  );
}

function SerialNumberField({
  serialNumber,
  onUpdateSerialNumber,
}: {
  serialNumber: string;
  onUpdateSerialNumber: (value: string) => void;
}) {
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerElementId = useId().replace(/:/g, "-");

  async function scanFromFile(file: File | null) {
    if (!file) return;
    setScanError(null);
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(scannerElementId, {
        verbose: false,
        formatsToSupport: BARCODE_FORMATS,
        useBarCodeDetectorIfSupported: true,
      });
      scannerRef.current = scanner;
      const decoded = await scanner.scanFile(file, true);
      if (!decoded || !decoded.trim()) {
        throw new Error("Ingen strekkode funnet i bildet.");
      }
      onUpdateSerialNumber(decoded.trim());
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Kunne ikke lese strekkoden.");
    } finally {
      setScanning(false);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try {
          scanner.clear();
        } catch {}
      }
    }
  }

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        try {
          scanner.clear();
        } catch {}
      }
    };
  }, []);

  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Serienummer
      </label>
      <div className="space-y-2">
        <input
          type="text"
          value={serialNumber}
          onChange={(e) => onUpdateSerialNumber(e.target.value)}
          placeholder="Skriv eller skann serienummer"
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/50 focus:outline-none"
        />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          Skann strekkode fra bilde
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              void scanFromFile(e.target.files?.[0] ?? null);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {scanning ? <p className="text-xs text-muted-foreground">Skanner bilde...</p> : null}
        {scanError ? <p className="text-xs font-semibold text-red-400">{scanError}</p> : null}
      </div>
      <div id={scannerElementId} className="sr-only" />
    </div>
  );
}

/* ── Panel body – shared between desktop sidebar and mobile overlay ── */

type PanelBodyProps = {
  onClose: () => void;
  activeTab: "status" | "drafts";
  onSetActiveTab: (t: "status" | "drafts") => void;
  activeTool: ToolId;
  activeLayer: OverlayLayer | null;
  layers: OverlayLayer[];
  activeLayerId: string;
  onSetActiveLayerId: (id: string) => void;
  checklist: DetectorChecklist | null;
  pointChecklist: PointChecklist | null;
  selectedDraftDetectorItem: {
    layer: OverlayLayer;
    item: Extract<OverlayItem, { type: "detector" }> | Extract<OverlayItem, { type: "point" }>;
  } | null;
  onUpdateChecklist: (next: Partial<DetectorChecklist> | Partial<PointChecklist>) => void;
  onAttachPhoto: (file: File | null) => Promise<void>;
  draftError: string | null;
  draftRows: DraftPublishRow[];
  visibilityMap: Record<string, OverlayVisibility>;
  onSetVisibilityMap: React.Dispatch<React.SetStateAction<Record<string, OverlayVisibility>>>;
  pending: boolean;
  publishError: string | null;
  onPublishOne: (row: DraftPublishRow) => void;
  onPublishAll: () => void;
  publishingAll: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

function PanelBody({
  onClose,
  activeTab,
  onSetActiveTab,
  activeTool,
  activeLayer,
  layers,
  activeLayerId,
  onSetActiveLayerId,
  checklist,
  pointChecklist,
  selectedDraftDetectorItem,
  onUpdateChecklist,
  onAttachPhoto,
  draftError,
  draftRows,
  visibilityMap,
  onSetVisibilityMap,
  pending,
  publishError,
  onPublishOne,
  onPublishAll,
  publishingAll,
  onUndo,
  onRedo,
}: PanelBodyProps) {
  return (
    <>
      {/* Tab bar */}
      <div className="flex shrink-0 items-stretch justify-between border-b border-border">
        <div className="flex">
          {(["status", "drafts"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onSetActiveTab(tab)}
              className={`relative px-5 py-3.5 text-sm font-semibold tracking-tight transition-colors ${
                activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "status" ? "Status" : "Utkast"}
              {tab === "drafts" && draftRows.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  {draftRows.length}
                </span>
              )}
              {activeTab === tab && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Lukk"
          className="flex items-center justify-center px-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Context strip */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Verktøy</span>
          <span className="text-xs font-bold text-primary">{activeTool}</span>
        </div>
        {activeLayer && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10" style={{ backgroundColor: activeLayer.color }} />
            <span className="text-xs font-semibold text-foreground">{activeLayer.name}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            title="Angre (Ctrl+Z)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V4m0 3l3-3M3 7a6 6 0 109 0" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRedo}
            title="Gjør om (Ctrl+Y)"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7V4m0 3l-3-3M13 7a6 6 0 11-9 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ── STATUS TAB ── */}
        {activeTab === "status" && (
          <div className="space-y-4 px-4 py-4">
            {/* Layer selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Aktivt lag</p>
              <div className="flex flex-wrap gap-1.5">
                {layers.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => onSetActiveLayerId(layer.id)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                      activeLayerId === layer.id
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layer.color }} />
                    {layer.name}
                    <span className="text-muted-foreground">·{layer.items.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Detektor status */}
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-foreground">Detektor-status</h2>
                {selectedDraftDetectorItem && (
                  <span className="text-xs text-muted-foreground">{selectedDraftDetectorItem.layer.name}</span>
                )}
              </div>

              {selectedDraftDetectorItem ? (
                <div className="space-y-3">
                  {selectedDraftDetectorItem.item.type === "detector" && checklist ? (
                    <>
                      <NeonCheckbox
                        checked={checklist.baseMounted}
                        onChange={(v) => onUpdateChecklist({ baseMounted: v })}
                        label="Sokkel montert"
                      />
                      <NeonCheckbox
                        checked={checklist.detectorMounted}
                        onChange={(v) => onUpdateChecklist({ detectorMounted: v })}
                        label="Detektor montert"
                      />

                      <div>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Kappe</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(["yes", "no"] as const).map((v) => {
                            const active = checklist.capOn === v;
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => onUpdateChecklist({ capOn: v })}
                                className={`rounded-xl border py-3 text-sm font-semibold transition-all active:scale-[0.97] ${
                                  active
                                    ? "border-primary/40 bg-primary/10 text-foreground"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                }`}
                              >
                                {v === "yes" ? "Ja" : "Nei"}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => onUpdateChecklist({ capOn: null })}
                            className={`rounded-xl border py-3 text-sm font-semibold transition-all active:scale-[0.97] ${
                              checklist.capOn === null
                                ? "border-border bg-muted text-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            }`}
                          >
                            —
                          </button>
                        </div>
                      </div>
                    </>
                  ) : null}

                  {/* Comment */}
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Kommentar
                    </label>
                    <textarea
                      value={(selectedDraftDetectorItem.item.type === "detector" ? checklist?.comment : pointChecklist?.comment) ?? ""}
                      onChange={(e) => onUpdateChecklist({ comment: e.target.value })}
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/50 focus:outline-none"
                      placeholder={selectedDraftDetectorItem.item.type === "detector" ? "F.eks. Mangler strøm, følges opp..." : "Hva må følges opp her?"}
                    />
                  </div>

                  {selectedDraftDetectorItem.item.type === "detector" && checklist ? (
                    <SerialNumberField
                      serialNumber={checklist.serialNumber ?? ""}
                      onUpdateSerialNumber={(value) => onUpdateChecklist({ serialNumber: value })}
                    />
                  ) : null}

                  {/* Photo */}
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Bildevedlegg
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground active:bg-muted">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                        Ta bilde
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
                          onChange={(e) => {
                            void onAttachPhoto(e.target.files?.[0] ?? null);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground active:bg-muted">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Velg fil
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            void onAttachPhoto(e.target.files?.[0] ?? null);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {((selectedDraftDetectorItem.item.type === "detector" ? checklist?.photoDataUrl : pointChecklist?.photoDataUrl) ?? null) ? (
                      <img
                        src={(selectedDraftDetectorItem.item.type === "detector" ? checklist?.photoDataUrl : pointChecklist?.photoDataUrl) ?? ""}
                        alt="Vedlegg"
                        className="mt-3 h-36 w-full rounded-xl border border-border object-cover"
                      />
                    ) : (
                      <p className="mt-2 text-center text-xs text-muted-foreground">Ingen vedlegg ennå</p>
                    )}
                    {draftError && (
                      <p className="mt-2 text-xs font-semibold text-red-400">{draftError}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Velg et detektor- eller punkt-element</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Trykk på et element i tegningen for å redigere statusen.
                  </p>
                </div>
              )}
            </div>

            {/* Tips box */}
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tips</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>• Trykk på et detektor- eller punkt-element for status</li>
                <li>• I linje-modus: dra i 4 håndtak for å bøye kurven</li>
                <li>• Klyp for å zoome, bruk «Velg» + dra for å panorere</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── DRAFTS TAB ── */}
        {activeTab === "drafts" && (
          <div className="space-y-4 px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-foreground">Utkast</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Lagres lokalt. Publiser hvert element med ønsket synlighet.
                </p>
              </div>
              {draftRows.length > 1 && (
                <button
                  type="button"
                  onClick={onPublishAll}
                  disabled={publishingAll || pending}
                  className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                >
                  {publishingAll ? "Publiserer…" : "Publiser alle"}
                </button>
              )}
            </div>

            {publishError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs font-semibold text-red-400">
                {publishError}
              </div>
            )}

            {draftRows.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/30 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-muted-foreground">Ingen utkast ennå</p>
                <p className="mt-1 text-xs text-muted-foreground">Tegn noe for å opprette et utkast.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {draftRows.map((row) => (
                  <li key={row.localKey} className="rounded-xl border border-border bg-background p-3.5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground">
                        {row.item.type}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.layerColor }} />
                        <span className="text-xs text-muted-foreground">{row.layerName}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={visibilityMap[row.localKey] ?? "all"}
                        onChange={(e) =>
                          onSetVisibilityMap((prev) => ({
                            ...prev,
                            [row.localKey]: e.target.value as OverlayVisibility,
                          }))
                        }
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
                      >
                        <option value="all">Synlig: alle</option>
                        <option value="admins">Kun admin</option>
                      </select>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onPublishOne(row)}
                        className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                      >
                        Publiser
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Main workbench ── */

export function PaintWorkbench({
  drawingId,
  currentUserId,
  fileUrl,
  filePath,
  drawingName,
  initialPublished,
}: Props) {
  const [activeTool, setActiveTool] = useState<ToolId>("detector");
  const [layers, setLayersRaw] = useState<OverlayLayer[]>([newLayer(1)]);
  const layersRef = useRef<OverlayLayer[]>(layers);
  const historyRef = useRef<OverlayLayer[][]>([]);
  const historyIdxRef = useRef(-1);
  const historyLastCommitAtRef = useRef(0);

  function deepCloneLayers(value: OverlayLayer[]): OverlayLayer[] {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as OverlayLayer[];
  }

  function setLayers(next: OverlayLayer[]) {
    layersRef.current = next;
    setLayersRaw(next);
  }

  function initHistory(initial: OverlayLayer[]) {
    historyRef.current = [deepCloneLayers(initial)];
    historyIdxRef.current = 0;
    historyLastCommitAtRef.current = Date.now();
  }

  const setLayersWithHistory = useCallback((updater: (prev: OverlayLayer[]) => OverlayLayer[]) => {
    const next = updater(layersRef.current);
    const snapshot = deepCloneLayers(next);
    const now = Date.now();
    const tooSoon = now - historyLastCommitAtRef.current < 180;
    const base = historyRef.current.slice(0, historyIdxRef.current + 1);
    if (tooSoon && base.length > 0) {
      base[base.length - 1] = snapshot;
      historyRef.current = base;
    } else {
      historyRef.current = [...base, snapshot].slice(-51);
      historyLastCommitAtRef.current = now;
    }
    historyIdxRef.current = historyRef.current.length - 1;
    layersRef.current = next;
    setLayersRaw(next);
  }, []);

  function undo() {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const state = deepCloneLayers(historyRef.current[historyIdxRef.current]);
    setLayers(state);
  }

  function redo() {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const state = deepCloneLayers(historyRef.current[historyIdxRef.current]);
    setLayers(state);
  }
  const [activeLayerId, setActiveLayerId] = useState<string>("");
  const [publishedOverlays, setPublishedOverlays] = useState<PublishedOverlay[]>(initialPublished);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [visibilityMap, setVisibilityMap] = useState<Record<string, OverlayVisibility>>({});
  const [selectedDraftDetector, setSelectedDraftDetector] = useState<{ layerId: string; itemId: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"status" | "drafts">("status");
  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeToolRef = useRef<ToolId>(activeTool);

  const storageKey = useMemo(() => `paint:draft:${drawingId}:${currentUserId}`, [drawingId, currentUserId]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      const fallback = [newLayer(1)];
      setLayers(fallback);
      setActiveLayerId(fallback[0].id);
      initHistory(fallback);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as OverlayLayer[];
      const cleaned = parsed
        .filter((layer) => layer && typeof layer.id === "string")
        .map((layer, idx) => ({
          id: layer.id || crypto.randomUUID(),
          name: layer.name || `Lag ${idx + 1}`,
          visible: layer.visible !== false,
          color: layer.color || LAYER_COLORS[idx % LAYER_COLORS.length],
          items: (layer.items ?? []).filter(isOverlayItem),
        }));
      if (cleaned.length === 0) {
        const fallback = [newLayer(1)];
        setLayers(fallback);
        setActiveLayerId(fallback[0].id);
        initHistory(fallback);
      } else {
        setLayers(cleaned);
        setActiveLayerId(cleaned[0].id);
        initHistory(cleaned);
      }
    } catch {
      const fallback = [newLayer(1)];
      setLayers(fallback);
      setActiveLayerId(fallback[0].id);
      initHistory(fallback);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!activeLayerId && layers.length > 0) setActiveLayerId(layers[0].id);
  }, [layers, activeLayerId]);

  useEffect(() => {
    if (layers.length === 0) {
      const fallback = [newLayer(1)];
      setLayers(fallback);
      setActiveLayerId(fallback[0].id);
      return;
    }
    const hasActive = layers.some((l) => l.id === activeLayerId);
    if (!hasActive) setActiveLayerId(layers[0].id);
  }, [layers, activeLayerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, JSON.stringify(layers));
    }, 120);
    return () => window.clearTimeout(timer);
  }, [layers, storageKey]);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      // Undo: Ctrl+Z / Cmd+Z
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === "z") {
        event.preventDefault();
        undo();
        return;
      }
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y
      if (((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "z") ||
          ((event.ctrlKey || event.metaKey) && event.key === "y")) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tool = TOOL_KEY_BINDINGS[event.key];
      if (!tool) return;
      event.preventDefault();
      setActiveTool(tool);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* Single-tap a detector → auto-open the status panel */
  useEffect(() => {
    if (!selectedDraftDetector) return;
    if (!PANEL_AUTO_OPEN_TOOLS.has(activeToolRef.current)) return;
    setActiveTab("status");
    setPanelOpen(true);
  }, [selectedDraftDetector]);

  function addLayer() {
    setLayersWithHistory((prev) => {
      const layer = newLayer(prev.length + 1);
      setActiveLayerId(layer.id);
      return [...prev, layer];
    });
  }

  function toggleLayer(layerId: string) {
    setLayersWithHistory((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
    );
  }

  function clearActiveLayer() {
    setLayersWithHistory((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, items: [] } : l)));
    setSelectedDraftDetector(null);
  }

  const publishedLayers = useMemo<OverlayLayer[]>(() => {
    const byLayer = new Map<string, OverlayLayer>();
    for (const row of publishedOverlays) {
      const key = `${row.layerName}::${row.layerColor}`;
      const existing = byLayer.get(key);
      if (!existing) {
        byLayer.set(key, {
          id: `published:${key}`,
          name: `${row.layerName} (publisert)`,
          visible: true,
          color: row.layerColor,
          items: [row.payload],
        });
      } else {
        existing.items.push(row.payload);
      }
    }
    return Array.from(byLayer.values());
  }, [publishedOverlays]);

  const draftRows = useMemo<DraftPublishRow[]>(() => {
    const out: DraftPublishRow[] = [];
    for (const layer of layers) {
      layer.items.forEach((item, index) => {
        out.push({
          item,
          layerId: layer.id,
          layerName: layer.name,
          layerColor: layer.color,
          indexInLayer: index,
          localKey: `${layer.id}:${index}:${item.id}`,
        });
      });
    }
    return out;
  }, [layers]);

  const selectedDraftDetectorItem = useMemo(() => {
    if (!selectedDraftDetector) return null;
    const layer = layers.find((l) => l.id === selectedDraftDetector.layerId);
    if (!layer) return null;
    const item = layer.items.find((i) => i.id === selectedDraftDetector.itemId);
    if (!item || (item.type !== "detector" && item.type !== "point")) return null;
    return { layer, item };
  }, [layers, selectedDraftDetector]);

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? null,
    [layers, activeLayerId],
  );

  function removeDraftRow(row: DraftPublishRow) {
    setLayersWithHistory((prev) =>
      prev.map((layer) =>
        layer.id === row.layerId
          ? { ...layer, items: layer.items.filter((item) => item.id !== row.item.id) }
          : layer,
      ),
    );
  }

  function updateSelectedDetectorChecklist(next: Partial<DetectorChecklist> | Partial<PointChecklist>) {
    if (!selectedDraftDetector) return;
    const updated = layersRef.current.map((layer) => {
        if (layer.id !== selectedDraftDetector.layerId) return layer;
        return {
          ...layer,
          items: layer.items.map((item) => {
            if (item.id !== selectedDraftDetector.itemId) return item;
            if (item.type === "detector") {
              const current = toChecklist(item.checklist);
              return { ...item, checklist: { ...current, ...(next as Partial<DetectorChecklist>), updatedAt: new Date().toISOString() } };
            }
            if (item.type === "point") {
              const current = toPointChecklist(item.checklist);
              return { ...item, checklist: { ...current, ...(next as Partial<PointChecklist>), updatedAt: new Date().toISOString() } };
            }
            return item;
          }),
        };
      });
    setLayers(updated);
  }

  async function onAttachPhoto(file: File | null) {
    if (!file) return;
    setDraftError(null);
    if (!file.type.startsWith("image/")) {
      setDraftError("Kun bildefiler støttes som vedlegg.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setDraftError("Bildet er for stort. Maks 2 MB per detektor.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Kunne ikke lese filen"));
      reader.readAsDataURL(file);
    });
    updateSelectedDetectorChecklist({ photoDataUrl: dataUrl });
  }

  const [publishingAll, setPublishingAll] = useState(false);

  async function publishAllDrafts() {
    if (publishingAll || draftRows.length === 0) return;
    setPublishingAll(true);
    setPublishError(null);
    const snapshot = [...draftRows];
    for (const row of snapshot) {
      const visibility = visibilityMap[row.localKey] ?? "all";
      const result = await publishOverlayItem({
        drawingId,
        toolType: row.item.type,
        layerName: row.layerName,
        layerColor: row.layerColor,
        visibilityScope: visibility,
        payload: row.item,
      });
      if (!result.ok) {
        setPublishError(result.error);
        setPublishingAll(false);
        return;
      }
      const data = result.data as {
        id: string;
        drawing_id: string;
        created_by: string;
        tool_type: ToolId;
        layer_name: string;
        layer_color: string;
        payload: OverlayItem;
        visibility_scope: OverlayVisibility;
      };
      setPublishedOverlays((prev) => [
        ...prev,
        {
          id: data.id,
          drawingId: data.drawing_id,
          createdBy: data.created_by,
          toolType: data.tool_type,
          layerName: data.layer_name,
          layerColor: data.layer_color,
          payload: data.payload,
          visibilityScope: data.visibility_scope,
        },
      ]);
      removeDraftRow(row);
    }
    setPublishingAll(false);
  }

  function publishOne(row: DraftPublishRow) {
    const visibility = visibilityMap[row.localKey] ?? "all";
    setPublishError(null);
    startTransition(async () => {
      const result = await publishOverlayItem({
        drawingId,
        toolType: row.item.type,
        layerName: row.layerName,
        layerColor: row.layerColor,
        visibilityScope: visibility,
        payload: row.item,
      });
      if (!result.ok) {
        setPublishError(result.error);
        return;
      }
      const data = result.data as {
        id: string;
        drawing_id: string;
        created_by: string;
        tool_type: ToolId;
        layer_name: string;
        layer_color: string;
        payload: OverlayItem;
        visibility_scope: OverlayVisibility;
      };
      setPublishedOverlays((prev) => [
        ...prev,
        {
          id: data.id,
          drawingId: data.drawing_id,
          createdBy: data.created_by,
          toolType: data.tool_type,
          layerName: data.layer_name,
          layerColor: data.layer_color,
          payload: data.payload,
          visibilityScope: data.visibility_scope,
        },
      ]);
      removeDraftRow(row);
    });
  }

  const checklist =
    selectedDraftDetectorItem?.item.type === "detector"
      ? toChecklist(selectedDraftDetectorItem.item.checklist)
      : null;
  const pointChecklist =
    selectedDraftDetectorItem?.item.type === "point"
      ? toPointChecklist(selectedDraftDetectorItem.item.checklist)
      : null;

  const panelBodyProps: Omit<PanelBodyProps, "onClose"> = {
    activeTab,
    onSetActiveTab: setActiveTab,
    activeTool,
    activeLayer,
    layers,
    activeLayerId,
    onSetActiveLayerId: setActiveLayerId,
    checklist,
    pointChecklist,
    selectedDraftDetectorItem,
    onUpdateChecklist: updateSelectedDetectorChecklist,
    onAttachPhoto,
    draftError,
    draftRows,
    visibilityMap,
    onSetVisibilityMap: setVisibilityMap,
    pending,
    publishError,
    onPublishOne: publishOne,
    onPublishAll: publishAllDrafts,
    publishingAll,
    onUndo: undo,
    onRedo: redo,
  };

  return (
    /* Root: horizontal flex — left sidebar | canvas column | right panel */
    <div className="relative flex h-full overflow-hidden">

      {/* ── LEFT SIDEBAR – desktop only ── */}
      <nav className="hidden shrink-0 sm:flex sm:w-14 sm:flex-col sm:border-r sm:border-border sm:bg-background">
        <PaintToolbar
          sidebar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          layers={layers}
          activeLayerId={activeLayerId}
          onSetActiveLayer={setActiveLayerId}
          onAddLayer={addLayer}
          onToggleLayer={toggleLayer}
          onClearActiveLayer={clearActiveLayer}
        />
      </nav>

      {/* ── CANVAS COLUMN: canvas + mobile toolbar (flex column, no overlap) ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Canvas fills remaining height */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <PaintCanvas
            fileUrl={fileUrl}
            filePath={filePath}
            drawingName={drawingName}
            activeTool={activeTool}
            publishedLayers={publishedLayers}
            draftLayers={layers}
            activeLayerId={activeLayerId}
            onUpdateLayers={setLayersWithHistory}
            selectedDraftDetector={selectedDraftDetector}
            onSelectDraftDetector={setSelectedDraftDetector}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
            onOpenStatusPanel={() => {
              setActiveTab("status");
              setPanelOpen(true);
            }}
          />
        </div>

        {/* Mobile bottom toolbar – below canvas (never overlaps!) */}
        <div className="relative z-30 shrink-0 border-t border-border bg-background/98 backdrop-blur-sm sm:hidden">
          <PaintToolbar
            bottomBar
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
            activeLayer={activeLayer}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            layers={layers}
            activeLayerId={activeLayerId}
            onSetActiveLayer={setActiveLayerId}
            onAddLayer={addLayer}
            onToggleLayer={toggleLayer}
            onClearActiveLayer={clearActiveLayer}
          />
        </div>
      </div>

      {/* ── RIGHT PANEL – desktop: part of flex layout (no overlay, no shadow) ── */}
      <aside
        className={`hidden shrink-0 flex-col border-l border-border bg-background text-foreground transition-all duration-200 ease-out sm:flex ${
          panelOpen ? "w-72 xl:w-80" : "w-0 overflow-hidden border-l-0"
        }`}
      >
        {panelOpen && (
          <PanelBody onClose={() => setPanelOpen(false)} {...panelBodyProps} />
        )}
      </aside>

      {/* ── MOBILE BACKDROP ── */}
      {panelOpen && (
        <button
          type="button"
          aria-label="Lukk panel"
          onClick={() => setPanelOpen(false)}
          className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[1px] sm:hidden"
        />
      )}

      {/* ── MOBILE PANEL – slide-in overlay ── */}
      <aside
        className={`absolute inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-background text-foreground shadow-2xl transition-transform duration-180 ease-out sm:hidden ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "min(22rem, 100vw)" }}
      >
        {panelOpen ? <PanelBody onClose={() => setPanelOpen(false)} {...panelBodyProps} /> : null}
      </aside>
    </div>
  );
}

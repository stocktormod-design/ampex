"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ListTodo, Trash2 } from "lucide-react";
import {
  publishOverlayItem,
  deleteOverlayItem,
  updateOverlayVisibility,
  updatePublishedOverlayPayload,
} from "@/app/dashboard/projects/actions";
import {
  createDrawingTask,
  deleteDrawingTask,
  setDrawingTaskCompleted,
  type DrawingTaskRow,
} from "@/app/dashboard/projects/drawing-tasks-actions";
import { exportDetectorReportPdf, exportDetectorReportXml } from "@/app/dashboard/projects/drawing-detector-report-actions";
import { PaintCanvas } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-canvas";
import { PaintToolbar } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-toolbar";
import type {
  CompanyMember,
  DetectorChecklist,
  PointChecklist,
  OverlayItem,
  OverlayLayer,
  PublishedOverlay,
  ToolId,
} from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type Props = {
  projectId: string;
  projectName: string;
  drawingId: string;
  currentUserId: string;
  fileUrl: string;
  filePath: string;
  drawingName: string;
  initialPublished: PublishedOverlay[];
  initialTasks: DrawingTaskRow[];
  companyMembers: CompanyMember[];
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

/** Korte tekster som ofte brukes i felt — ett trykk legger til (ny linje hvis det allerede står noe). */
const COMMENT_QUICK_TEXTS = [
  "Utført iht. tegning.",
  "Avvik — se bilde.",
  "Mangler materiale.",
  "Avventer kunde.",
  "Ikke tilgjengelig på befaring.",
] as const;
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

function CollapseSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-foreground [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-[10px] font-normal text-muted-foreground transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="space-y-3 border-t border-border px-3 pb-3 pt-2">{children}</div>
    </details>
  );
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

function VisibilityPicker({
  members,
  value,
  onChange,
}: {
  members: CompanyMember[];
  value: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const allSelected = value === null;
  return (
    <div className="space-y-1.5">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Synlig for
      </label>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all active:scale-[0.99] ${
          allSelected
            ? "border-primary/30 bg-primary/5 text-primary"
            : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        }`}
      >
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${allSelected ? "border-primary bg-primary" : "border-border"}`}>
          {allSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="font-semibold">Alle med tilgang</span>
      </button>
      {members.map((m) => {
        const selected = !allSelected && value.includes(m.id);
        function toggle() {
          if (allSelected) {
            onChange([m.id]);
            return;
          }
          const next = selected ? value.filter((id) => id !== m.id) : [...value, m.id];
          onChange(next.length === 0 ? null : next);
        }
        return (
          <button
            key={m.id}
            type="button"
            onClick={toggle}
            className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all active:scale-[0.99] ${
              selected
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2 transition-all ${selected ? "border-primary bg-primary/15" : "border-border bg-muted"}`}>
              {selected && (
                <svg className="h-2.5 w-2.5 text-primary" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                </svg>
              )}
            </span>
            <span>{m.fullName ?? m.id.slice(0, 8)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Panel body – shared between desktop sidebar and mobile overlay ── */

export type PanelTab = "status" | "drafts" | "tasks";

type PanelBodyProps = {
  onClose: () => void;
  projectName: string;
  activeTab: PanelTab;
  onSetActiveTab: (t: PanelTab) => void;
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
  visibilityMap: Record<string, string[] | null>;
  onSetVisibilityMap: React.Dispatch<React.SetStateAction<Record<string, string[] | null>>>;
  pending: boolean;
  publishError: string | null;
  onPublishOne: (row: DraftPublishRow) => void;
  onPublishAll: () => void;
  onPublishSelected: () => void;
  publishingAll: boolean;
  groupSelectMode: boolean;
  onSetGroupSelectMode: (next: boolean) => void;
  selectedDraftKeys: Record<string, boolean>;
  onToggleDraftKey: (key: string, checked: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  publishedOverlays: PublishedOverlay[];
  onDeletePublished: (id: string) => Promise<void>;
  onUpdatePublishedVisibility: (id: string, visibleToUserIds: string[] | null) => Promise<void>;
  companyMembers: CompanyMember[];
  drawingTasks: DrawingTaskRow[];
  onAddDrawingTask: (title: string, description: string) => void;
  onToggleDrawingTask: (taskId: string, completed: boolean) => void;
  onDeleteDrawingTask: (taskId: string) => void;
  pointSummaries: { source: "utkast" | "publisert"; layerName: string; comment: string }[];
  reportBusy: boolean;
  onExportDetectorPdf: () => void;
  onExportDetectorXml: () => void;
  taskFeedback: string | null;
  selectedDraftItemId: { layerId: string; itemId: string } | null;
  onActivateDraftRow: (row: DraftPublishRow) => void;
};

function PanelBody({
  onClose,
  projectName,
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
  onPublishSelected,
  publishingAll,
  groupSelectMode,
  onSetGroupSelectMode,
  selectedDraftKeys,
  onToggleDraftKey,
  onUndo,
  onRedo,
  publishedOverlays,
  onDeletePublished,
  onUpdatePublishedVisibility,
  companyMembers,
  drawingTasks,
  onAddDrawingTask,
  onToggleDrawingTask,
  onDeleteDrawingTask,
  pointSummaries,
  reportBusy,
  onExportDetectorPdf,
  onExportDetectorXml,
  taskFeedback,
  selectedDraftItemId,
  onActivateDraftRow,
}: PanelBodyProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [editingVisibility, setEditingVisibility] = useState<string[] | null>(null);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    if (activeTab !== "drafts" || !selectedDraftItemId) return;
    const row = draftRows.find(
      (r) => r.layerId === selectedDraftItemId.layerId && r.item.id === selectedDraftItemId.itemId,
    );
    if (!row) return;
    const el = document.getElementById(`draft-card-${row.localKey}`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeTab, selectedDraftItemId, draftRows]);

  async function saveOverlayVisibility() {
    if (!editingOverlayId) return;
    setSavingVisibility(true);
    await onUpdatePublishedVisibility(editingOverlayId, editingVisibility);
    setSavingVisibility(false);
    setEditingOverlayId(null);
  }

  const selectedCount = useMemo(
    () => draftRows.filter((row) => selectedDraftKeys[row.localKey]).length,
    [draftRows, selectedDraftKeys],
  );

  const sortedTasks = useMemo(() => {
    return [...drawingTasks].sort((a, b) => {
      const ac = a.completed_at ? 1 : 0;
      const bc = b.completed_at ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return a.sort_order - b.sort_order;
    });
  }, [drawingTasks]);

  return (
    <>
      {/* Tab bar */}
      <div className="flex shrink-0 items-stretch justify-between border-b border-border">
        <div className="flex min-w-0">
          {(["status", "tasks", "drafts"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onSetActiveTab(tab)}
              className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 px-2 py-3 text-xs font-semibold tracking-tight transition-colors sm:px-4 sm:text-sm ${
                activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "status" ? "Status" : tab === "tasks" ? (
                <>
                  <ListTodo className="size-3.5 shrink-0 sm:hidden" aria-hidden />
                  <span className="truncate">Oppgaver</span>
                </>
              ) : "Utkast"}
              {tab === "drafts" && draftRows.length > 0 && (
                <span className="ml-0.5 shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
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

            {/* Detektor / punkt — kompakt med sammenlegg */}
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold text-foreground">Element</h2>
                {selectedDraftDetectorItem && (
                  <span className="truncate text-xs text-muted-foreground">{selectedDraftDetectorItem.layer.name}</span>
                )}
              </div>

              {selectedDraftDetectorItem ? (
                <div className="space-y-2">
                  {selectedDraftDetectorItem.item.type === "detector" && checklist ? (
                    <CollapseSection title="Montering og kappe" defaultOpen>
                      <div className="space-y-2">
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
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Kappe på plass?</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["yes", "no"] as const).map((v) => {
                            const active = checklist.capOn === v;
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() => onUpdateChecklist({ capOn: v })}
                                className={`rounded-lg border py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
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
                            className={`rounded-lg border py-2 text-xs font-semibold transition-all active:scale-[0.98] ${
                              checklist.capOn === null
                                ? "border-border bg-muted text-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            }`}
                          >
                            —
                          </button>
                        </div>
                      </div>
                    </CollapseSection>
                  ) : null}

                  <CollapseSection title="Notat" defaultOpen>
                    <div className="flex flex-wrap gap-1">
                      {COMMENT_QUICK_TEXTS.map((snippet) => (
                        <button
                          key={snippet}
                          type="button"
                          onClick={() => {
                            const cur =
                              (selectedDraftDetectorItem.item.type === "detector"
                                ? checklist?.comment
                                : pointChecklist?.comment) ?? "";
                            const next = cur.trim() ? `${cur.trim()}\n${snippet}` : snippet;
                            onUpdateChecklist({ comment: next });
                          }}
                          className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-left text-[11px] text-foreground transition-colors hover:bg-muted"
                        >
                          + {snippet}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={(selectedDraftDetectorItem.item.type === "detector" ? checklist?.comment : pointChecklist?.comment) ?? ""}
                      onChange={(e) => onUpdateChecklist({ comment: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                      placeholder={selectedDraftDetectorItem.item.type === "detector" ? "Kort notat…" : "Hva må følges opp?"}
                    />
                  </CollapseSection>

                  {selectedDraftDetectorItem.item.type === "detector" && checklist ? (
                    <CollapseSection title="Serienummer og bilde" defaultOpen={false}>
                      <SerialNumberField
                        serialNumber={checklist.serialNumber ?? ""}
                        onUpdateSerialNumber={(value) => onUpdateChecklist({ serialNumber: value })}
                      />
                      <div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
                            <span>Ta bilde</span>
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
                          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
                            <span>Velg fil</span>
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
                            className="mt-2 max-h-28 w-full rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <p className="mt-2 text-center text-[11px] text-muted-foreground">Ingen bilde</p>
                        )}
                        {draftError && <p className="mt-1 text-xs font-semibold text-red-400">{draftError}</p>}
                      </div>
                    </CollapseSection>
                  ) : (
                    <CollapseSection title="Bilde (punkt)" defaultOpen={false}>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background py-2 text-[11px] font-semibold text-muted-foreground">
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
                        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background py-2 text-[11px] font-semibold text-muted-foreground">
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
                      {(pointChecklist?.photoDataUrl ?? null) ? (
                        <img src={pointChecklist?.photoDataUrl ?? ""} alt="Vedlegg" className="mt-2 max-h-28 w-full rounded-lg border object-cover" />
                      ) : (
                        <p className="mt-2 text-center text-[11px] text-muted-foreground">Ingen bilde</p>
                      )}
                      {draftError && <p className="mt-1 text-xs font-semibold text-red-400">{draftError}</p>}
                    </CollapseSection>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-6 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Velg detektor eller punkt på tegningen</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {activeTab === "tasks" && (
          <div className="space-y-4 px-4 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prosjekt</p>
              <p className="text-sm font-semibold text-foreground">{projectName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Oppgaver lagres i databasen og deles med teamet som har tilgang til tegningen.</p>
            </div>

            {taskFeedback && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{taskFeedback}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={reportBusy}
                onClick={onExportDetectorPdf}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                {reportBusy ? "…" : "PDF detektorrapport"}
              </button>
              <button
                type="button"
                disabled={reportBusy}
                onClick={onExportDetectorXml}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                {reportBusy ? "…" : "XML detektorrapport"}
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/15 p-3">
              <p className="text-xs font-bold text-foreground">Ny oppgave</p>
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Tittel"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Beskrivelse (valgfritt)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  onAddDrawingTask(newTaskTitle, newTaskDesc);
                  setNewTaskTitle("");
                  setNewTaskDesc("");
                }}
                className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                Legg til
              </button>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dine oppgaver</p>
              {sortedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen oppgaver ennå.</p>
              ) : (
                <ul className="space-y-2">
                  {sortedTasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 rounded border-input"
                        checked={Boolean(t.completed_at)}
                        onChange={(e) => onToggleDrawingTask(t.id, e.target.checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${t.completed_at ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.title}</p>
                        {t.description ? <p className="text-xs text-muted-foreground">{t.description}</p> : null}
                      </div>
                      <button
                        type="button"
                        title="Slett"
                        onClick={() => onDeleteDrawingTask(t.id)}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Punkter på tegningen</p>
              {pointSummaries.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen punkt-markører ennå.</p>
              ) : (
                <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/10 p-2">
                  {pointSummaries.map((p, idx) => (
                    <li key={`${p.source}-${p.layerName}-${idx}`} className="text-xs text-foreground">
                      <span className="font-semibold text-muted-foreground">[{p.source}]</span> {p.layerName}: {p.comment}
                    </li>
                  ))}
                </ul>
              )}
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
                  Lagres lokalt pa enheten. Ved publisering blir elementer synlige for brukere med tegningstilgang.
                </p>
              </div>
              {draftRows.length > 1 && (
                <div className="flex shrink-0 items-center gap-2">
                  {!groupSelectMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onSetGroupSelectMode(true)}
                        disabled={publishingAll || pending}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                      >
                        Velg grupper
                      </button>
                      <button
                        type="button"
                        onClick={onPublishAll}
                        disabled={publishingAll || pending}
                        className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                      >
                        {publishingAll ? "Publiserer..." : "Publiser alle"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={onPublishSelected}
                        disabled={publishingAll || pending || selectedCount === 0}
                        className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                      >
                        {publishingAll ? "Publiserer..." : `Publiser valgte (${selectedCount})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetGroupSelectMode(false)}
                        disabled={publishingAll || pending}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                      >
                        Avbryt
                      </button>
                    </>
                  )}
                </div>
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
                {draftRows.map((row) => {
                  const isListSelected =
                    Boolean(selectedDraftItemId) &&
                    selectedDraftItemId?.layerId === row.layerId &&
                    selectedDraftItemId?.itemId === row.item.id;
                  return (
                  <li
                    key={row.localKey}
                    id={`draft-card-${row.localKey}`}
                    className={`rounded-xl border bg-background p-3.5 transition-shadow ${
                      isListSelected
                        ? "border-cyan-500/60 ring-2 ring-cyan-500/35 shadow-md"
                        : "border-border"
                    }`}
                    onClick={(e) => {
                      const t = e.target as HTMLElement;
                      if (t.closest("button, input, textarea, a, label")) return;
                      onActivateDraftRow(row);
                    }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      {groupSelectMode && (
                        <input
                          type="checkbox"
                          checked={Boolean(selectedDraftKeys[row.localKey])}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onToggleDraftKey(row.localKey, e.target.checked)}
                          className="size-4 rounded border-input"
                        />
                      )}
                      <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground">
                        {row.item.type}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.layerColor }} />
                        <span className="text-xs text-muted-foreground">{row.layerName}</span>
                      </span>
                    </div>
                    <VisibilityPicker
                      members={companyMembers}
                      value={visibilityMap[row.localKey] ?? null}
                      onChange={(v) =>
                        onSetVisibilityMap((prev) => ({ ...prev, [row.localKey]: v }))
                      }
                    />
                    <button
                      type="button"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        void onPublishOne(row);
                      }}
                      className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/10 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                    >
                      Publiser
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}

            {/* Published overlays — delete without unpublishing */}
            {publishedOverlays.length > 0 && (
              <div className="mt-2 border-t border-border pt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Publiserte elementer
                </p>
                <ul className="space-y-2">
                  {publishedOverlays.map((o) => {
                    const isEditing = editingOverlayId === o.id;
                    const visLabel = o.visibleToUserIds === null
                      ? "Alle"
                      : o.visibleToUserIds.length === 0
                        ? "Ingen"
                        : o.visibleToUserIds
                            .map((uid) => companyMembers.find((m) => m.id === uid)?.fullName ?? uid.slice(0, 6))
                            .join(", ");
                    return (
                      <li
                        key={o.id}
                        className="rounded-xl border border-border bg-background p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.layerColor }} />
                          <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                            <span className="mr-1.5 rounded border border-border bg-muted px-1 py-0.5 font-bold uppercase text-[9px] tracking-widest">
                              {o.toolType}
                            </span>
                            {o.layerName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingOverlayId(null);
                              } else {
                                setEditingOverlayId(o.id);
                                setEditingVisibility(o.visibleToUserIds);
                              }
                            }}
                            className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {isEditing ? "Avbryt" : "Rediger"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeletePublished(o.id)}
                            className="shrink-0 rounded-md border border-destructive/30 bg-background px-2 py-1 text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
                          >
                            Slett
                          </button>
                        </div>
                        <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
                          Synlig: <span className="font-semibold text-foreground">{visLabel}</span>
                        </p>
                        {isEditing && (
                          <div className="mt-3 space-y-2 border-t border-border pt-3">
                            <VisibilityPicker
                              members={companyMembers}
                              value={editingVisibility}
                              onChange={setEditingVisibility}
                            />
                            <button
                              type="button"
                              disabled={savingVisibility}
                              onClick={() => void saveOverlayVisibility()}
                              className="w-full rounded-lg border border-primary/30 bg-primary/10 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
                            >
                              {savingVisibility ? "Lagrer..." : "Lagre synlighet"}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Main workbench ── */

export function PaintWorkbench({
  projectId,
  projectName,
  drawingId,
  currentUserId,
  fileUrl,
  filePath,
  drawingName,
  initialPublished,
  initialTasks,
  companyMembers,
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

  async function handleDeletePublished(id: string) {
    const result = await deleteOverlayItem(id);
    if (result.ok) {
      setPublishedOverlays((prev) => prev.filter((o) => o.id !== id));
      if (selectedPublishedOverlayId === id) setSelectedPublishedOverlayId(null);
    }
  }

  async function handleUpdatePublishedVisibility(id: string, visibleToUserIds: string[] | null) {
    const result = await updateOverlayVisibility(id, visibleToUserIds);
    if (result.ok) {
      setPublishedOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, visibleToUserIds } : o)),
      );
    }
  }
  const [draftError, setDraftError] = useState<string | null>(null);
  const [visibilityMap, setVisibilityMap] = useState<Record<string, string[] | null>>({});
  const [selectedDraftDetector, setSelectedDraftDetector] = useState<{ layerId: string; itemId: string } | null>(null);
  const [selectedDraftItemId, setSelectedDraftItemId] = useState<{ layerId: string; itemId: string } | null>(null);
  const [selectedPublishedOverlayId, setSelectedPublishedOverlayId] = useState<string | null>(null);
  const [focusDraftTarget, setFocusDraftTarget] = useState<{ layerId: string; itemId: string; nonce: number } | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("status");
  const [drawingTasks, setDrawingTasks] = useState<DrawingTaskRow[]>(initialTasks);
  const [reportBusy, setReportBusy] = useState(false);
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

  /* Single-tap a detector → auto-open status-fanen (unntatt når utkast-fanen er aktiv). */
  useEffect(() => {
    if (activeTab === "drafts") return;
    if (!selectedDraftDetector) return;
    if (!PANEL_AUTO_OPEN_TOOLS.has(activeToolRef.current)) return;
    setActiveTab("status");
    setPanelOpen(true);
  }, [selectedDraftDetector, activeTab]);

  function activateDraftRow(row: DraftPublishRow) {
    setSelectedPublishedOverlayId(null);
    setSelectedDraftItemId({ layerId: row.layerId, itemId: row.item.id });
    if (row.item.type === "detector" || row.item.type === "point") {
      setSelectedDraftDetector({ layerId: row.layerId, itemId: row.item.id });
    } else {
      setSelectedDraftDetector(null);
    }
    setFocusDraftTarget({ layerId: row.layerId, itemId: row.item.id, nonce: Date.now() });
  }

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
    setSelectedPublishedOverlayId(null);
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

  const inlinePublishRow = useMemo(() => {
    if (!selectedDraftItemId) return null;
    return (
      draftRows.find(
        (row) => row.layerId === selectedDraftItemId.layerId && row.item.id === selectedDraftItemId.itemId,
      ) ?? null
    );
  }, [selectedDraftItemId, draftRows]);

  const selectedDraftDetectorItem = useMemo(() => {
    if (selectedPublishedOverlayId) {
      const ov = publishedOverlays.find((o) => o.id === selectedPublishedOverlayId);
      if (!ov || (ov.toolType !== "detector" && ov.toolType !== "point")) return null;
      const item = ov.payload;
      if (item.type !== "detector" && item.type !== "point") return null;
      const fakeLayer: OverlayLayer = {
        id: `published:${ov.id}`,
        name: `${ov.layerName} (publisert)`,
        visible: true,
        color: ov.layerColor,
        items: [],
      };
      return { layer: fakeLayer, item };
    }
    if (!selectedDraftDetector) return null;
    const layer = layers.find((l) => l.id === selectedDraftDetector.layerId);
    if (!layer) return null;
    const item = layer.items.find((i) => i.id === selectedDraftDetector.itemId);
    if (!item || (item.type !== "detector" && item.type !== "point")) return null;
    return { layer, item };
  }, [layers, selectedDraftDetector, selectedPublishedOverlayId, publishedOverlays]);

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
    if (selectedPublishedOverlayId) {
      const ov = publishedOverlays.find((o) => o.id === selectedPublishedOverlayId);
      if (!ov) return;
      const item = ov.payload;
      if (item.type === "detector") {
        const current = toChecklist(item.checklist);
        const nextPayload = {
          ...item,
          checklist: { ...current, ...(next as Partial<DetectorChecklist>), updatedAt: new Date().toISOString() },
        };
        void (async () => {
          const r = await updatePublishedOverlayPayload(selectedPublishedOverlayId, nextPayload);
          if (r.ok && "payload" in r) {
            setPublishedOverlays((prev) =>
              prev.map((o) => (o.id === selectedPublishedOverlayId ? { ...o, payload: r.payload as OverlayItem } : o)),
            );
          }
        })();
        return;
      }
      if (item.type === "point") {
        const current = toPointChecklist(item.checklist);
        const nextPayload = {
          ...item,
          checklist: { ...current, ...(next as Partial<PointChecklist>), updatedAt: new Date().toISOString() },
        };
        void (async () => {
          const r = await updatePublishedOverlayPayload(selectedPublishedOverlayId, nextPayload);
          if (r.ok && "payload" in r) {
            setPublishedOverlays((prev) =>
              prev.map((o) => (o.id === selectedPublishedOverlayId ? { ...o, payload: r.payload as OverlayItem } : o)),
            );
          }
        })();
      }
      return;
    }
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
  const [groupSelectMode, setGroupSelectMode] = useState(false);
  const [selectedDraftKeys, setSelectedDraftKeys] = useState<Record<string, boolean>>({});

  async function publishRows(rows: DraftPublishRow[]) {
    if (publishingAll || rows.length === 0) return;
    setPublishingAll(true);
    setPublishError(null);
    const snapshot = [...rows];
    for (const row of snapshot) {
      const visibleToUserIds = visibilityMap[row.localKey] ?? null;
      const result = await publishOverlayItem({
        drawingId,
        toolType: row.item.type,
        layerName: row.layerName,
        layerColor: row.layerColor,
        visibleToUserIds,
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
        visible_to_user_ids: string[] | null;
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
          visibleToUserIds: data.visible_to_user_ids,
        },
      ]);
      removeDraftRow(row);
    }
    setSelectedDraftKeys((prev) => {
      const next = { ...prev };
      for (const row of snapshot) delete next[row.localKey];
      return next;
    });
    setPublishingAll(false);
  }

  async function publishAllDrafts() {
    await publishRows(draftRows);
  }

  async function publishSelectedDrafts() {
    const selectedRows = draftRows.filter((row) => selectedDraftKeys[row.localKey]);
    await publishRows(selectedRows);
  }

  function publishOne(row: DraftPublishRow) {
    const visibleToUserIds = visibilityMap[row.localKey] ?? null;
    setPublishError(null);
    startTransition(async () => {
      const result = await publishOverlayItem({
        drawingId,
        toolType: row.item.type,
        layerName: row.layerName,
        layerColor: row.layerColor,
        visibleToUserIds,
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
        visible_to_user_ids: string[] | null;
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
          visibleToUserIds: data.visible_to_user_ids,
        },
      ]);
      removeDraftRow(row);
    });
  }

  function publishInlineItem() {
    if (!inlinePublishRow) return;
    const row = inlinePublishRow;
    const visibleToUserIds = visibilityMap[row.localKey] ?? null;
    setPublishError(null);
    startTransition(async () => {
      const result = await publishOverlayItem({
        drawingId,
        toolType: row.item.type,
        layerName: row.layerName,
        layerColor: row.layerColor,
        visibleToUserIds,
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
        visible_to_user_ids: string[] | null;
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
          visibleToUserIds: data.visible_to_user_ids,
        },
      ]);
      removeDraftRow(row);
      setSelectedDraftItemId(null);
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

  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);

  useEffect(() => {
    setDrawingTasks(initialTasks);
  }, [initialTasks]);

  const pointSummaries = useMemo(() => {
    const out: { source: "utkast" | "publisert"; layerName: string; comment: string }[] = [];
    for (const layer of layers) {
      for (const item of layer.items) {
        if (item.type !== "point") continue;
        const c = toPointChecklist(item.checklist);
        out.push({ source: "utkast", layerName: layer.name, comment: c.comment.trim() || "—" });
      }
    }
    for (const o of publishedOverlays) {
      if (o.toolType !== "point") continue;
      const p = o.payload as Extract<OverlayItem, { type: "point" }>;
      const c = toPointChecklist(p.checklist);
      out.push({ source: "publisert", layerName: o.layerName, comment: c.comment.trim() || "—" });
    }
    return out;
  }, [layers, publishedOverlays]);

  function handleAddDrawingTask(title: string, description: string) {
    const t = title.trim();
    if (!t) return;
    setTaskFeedback(null);
    startTransition(async () => {
      const r = await createDrawingTask(projectId, drawingId, t, description);
      if (r.ok) setDrawingTasks((prev) => [...prev, r.task]);
      else setTaskFeedback(r.error);
    });
  }

  function handleToggleDrawingTask(taskId: string, completed: boolean) {
    setTaskFeedback(null);
    startTransition(async () => {
      const r = await setDrawingTaskCompleted(projectId, drawingId, taskId, completed);
      if (r.ok) setDrawingTasks((prev) => prev.map((x) => (x.id === taskId ? r.task : x)));
      else setTaskFeedback(r.error);
    });
  }

  function handleDeleteDrawingTask(taskId: string) {
    setTaskFeedback(null);
    startTransition(async () => {
      const r = await deleteDrawingTask(projectId, drawingId, taskId);
      if (r.ok) setDrawingTasks((prev) => prev.filter((x) => x.id !== taskId));
      else setTaskFeedback(r.error);
    });
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportDetectorPdf() {
    setTaskFeedback(null);
    setReportBusy(true);
    void (async () => {
      try {
        const r = await exportDetectorReportPdf(projectId, drawingId);
        if (!r.ok) {
          setTaskFeedback(r.error);
          return;
        }
        const bin = atob(r.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        triggerDownload(new Blob([bytes], { type: "application/pdf" }), r.filename);
      } catch (e) {
        setTaskFeedback(e instanceof Error ? e.message : "Kunne ikke lage PDF");
      } finally {
        setReportBusy(false);
      }
    })();
  }

  function handleExportDetectorXml() {
    setTaskFeedback(null);
    setReportBusy(true);
    void (async () => {
      try {
        const r = await exportDetectorReportXml(projectId, drawingId);
        if (!r.ok) {
          setTaskFeedback(r.error);
          return;
        }
        triggerDownload(new Blob([r.xml], { type: "application/xml;charset=utf-8" }), r.filename);
      } catch (e) {
        setTaskFeedback(e instanceof Error ? e.message : "Kunne ikke lage XML");
      } finally {
        setReportBusy(false);
      }
    })();
  }

  const panelBodyProps: Omit<PanelBodyProps, "onClose"> = {
    projectName,
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
    onPublishSelected: publishSelectedDrafts,
    publishingAll,
    groupSelectMode,
    onSetGroupSelectMode: (next) => {
      setGroupSelectMode(next);
      if (!next) setSelectedDraftKeys({});
    },
    selectedDraftKeys,
    onToggleDraftKey: (key, checked) =>
      setSelectedDraftKeys((prev) => ({ ...prev, [key]: checked })),
    onUndo: undo,
    onRedo: redo,
    publishedOverlays,
    onDeletePublished: handleDeletePublished,
    onUpdatePublishedVisibility: handleUpdatePublishedVisibility,
    companyMembers,
    drawingTasks,
    onAddDrawingTask: handleAddDrawingTask,
    onToggleDrawingTask: handleToggleDrawingTask,
    onDeleteDrawingTask: handleDeleteDrawingTask,
    pointSummaries,
    reportBusy,
    onExportDetectorPdf: handleExportDetectorPdf,
    onExportDetectorXml: handleExportDetectorXml,
    taskFeedback,
    selectedDraftItemId,
    onActivateDraftRow: activateDraftRow,
  };

  return (
    /* Root: canvas | inspector (valgfritt) | verktøyrail (fast høyre, desktop) */
    <div className="relative flex h-full overflow-hidden">

      {/* ── CANVAS COLUMN: canvas + mobile toolbar (flex column, no overlap) ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col touch-manipulation [-webkit-tap-highlight-color:transparent]">
        {/* Canvas fills remaining height */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <PaintCanvas
            fileUrl={fileUrl}
            filePath={filePath}
            drawingName={drawingName}
            activeTool={activeTool}
            publishedLayers={publishedLayers}
            publishedOverlays={publishedOverlays}
            draftLayers={layers}
            activeLayerId={activeLayerId}
            onUpdateLayers={setLayersWithHistory}
            selectedDraftDetector={selectedDraftDetector}
            onSelectDraftDetector={(sel) => {
              setSelectedDraftDetector(sel);
              if (sel) setSelectedPublishedOverlayId(null);
            }}
            selectedPublishedOverlayId={selectedPublishedOverlayId}
            onSelectPublishedOverlay={(id) => {
              setSelectedPublishedOverlayId(id);
              if (id) {
                setSelectedDraftDetector(null);
                setSelectedDraftItemId(null);
              }
            }}
            suppressStatusPanelOnSelection={activeTab === "drafts" && panelOpen}
            focusDraftRequest={focusDraftTarget}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
            onOpenStatusPanel={() => {
              setActiveTab("status");
              setPanelOpen(true);
            }}
            onPinchZoom={() => setActiveTool("select")}
            onSelectDraftItem={(sel) => {
              setSelectedDraftItemId(sel);
              if (sel) setSelectedPublishedOverlayId(null);
            }}
            inlinePublish={inlinePublishRow ? {
              onPublish: publishInlineItem,
              pending,
            } : null}
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

      {/* ── DESKTOP: inspiseringspanel + verktøyrail (rail alltid synlig til høyre) ── */}
      <div className="hidden h-full shrink-0 flex-row border-l border-zinc-800/80 sm:flex">
        <aside
          className={`flex shrink-0 flex-col overflow-hidden bg-background text-foreground transition-[width] duration-150 ease-out ${
            panelOpen ? "w-72 border-r border-zinc-800/70 xl:w-80" : "w-0 border-r-0"
          }`}
        >
          {panelOpen ? <PanelBody onClose={() => setPanelOpen(false)} {...panelBodyProps} /> : null}
        </aside>
        <nav className="flex w-[4.875rem] shrink-0 flex-col bg-zinc-950/95 text-foreground backdrop-blur-sm xl:w-[5.25rem]">
          <PaintToolbar
            sidebar
            railEdge="right"
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
      </div>

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
        className={`absolute inset-y-0 right-0 z-50 flex touch-manipulation flex-col border-l border-border bg-background text-foreground shadow-2xl transition-transform duration-100 ease-out sm:hidden [-webkit-tap-highlight-color:transparent] ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "min(22rem, 100vw)" }}
      >
        {panelOpen ? <PanelBody onClose={() => setPanelOpen(false)} {...panelBodyProps} /> : null}
      </aside>
    </div>
  );
}

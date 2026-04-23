"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { publishOverlayItem } from "@/app/dashboard/projects/actions";
import { PaintCanvas } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-canvas";
import { PaintToolbar } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-toolbar";
import type {
  DetectorChecklist,
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
  return v.type === "detector" || v.type === "line" || v.type === "rect" || v.type === "text";
}

function toChecklist(value?: DetectorChecklist): DetectorChecklist {
  const v = (value ?? {}) as Partial<DetectorChecklist>;
  return {
    baseMounted: Boolean(v.baseMounted),
    detectorMounted: Boolean(v.detectorMounted),
    capOn: v.capOn === "yes" || v.capOn === "no" ? v.capOn : null,
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
          ? "border-cyan-500/40 bg-cyan-500/5"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
          checked
            ? "border-cyan-400 bg-cyan-400/20 shadow-[0_0_8px_rgba(34,211,238,0.35)]"
            : "border-zinc-600 bg-zinc-800"
        }`}
      >
        {checked && (
          <svg className="h-3 w-3 text-cyan-400" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
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
      <span className="text-sm font-medium text-zinc-100">{label}</span>
    </label>
  );
}

export function PaintWorkbench({
  drawingId,
  currentUserId,
  fileUrl,
  filePath,
  drawingName,
  initialPublished,
}: Props) {
  const [activeTool, setActiveTool] = useState<ToolId>("detector");
  const [layers, setLayers] = useState<OverlayLayer[]>([newLayer(1)]);
  const [activeLayerId, setActiveLayerId] = useState<string>("");
  const [publishedOverlays, setPublishedOverlays] = useState<PublishedOverlay[]>(initialPublished);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [visibilityMap, setVisibilityMap] = useState<Record<string, OverlayVisibility>>({});
  const [selectedDraftDetector, setSelectedDraftDetector] = useState<{ layerId: string; itemId: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"status" | "drafts">("status");
  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const prevDetectorTapRef = useRef<{ layerId: string; itemId: string; at: number } | null>(null);

  const storageKey = useMemo(() => `paint:draft:${drawingId}:${currentUserId}`, [drawingId, currentUserId]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      const fallback = [newLayer(1)];
      setLayers(fallback);
      setActiveLayerId(fallback[0].id);
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
      } else {
        setLayers(cleaned);
        setActiveLayerId(cleaned[0].id);
      }
    } catch {
      const fallback = [newLayer(1)];
      setLayers(fallback);
      setActiveLayerId(fallback[0].id);
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
    window.localStorage.setItem(storageKey, JSON.stringify(layers));
  }, [layers, storageKey]);

  useEffect(() => {
    if (!selectedDraftDetector) return;
    const now = Date.now();
    const prev = prevDetectorTapRef.current;
    const isDoubleTap =
      prev &&
      prev.layerId === selectedDraftDetector.layerId &&
      prev.itemId === selectedDraftDetector.itemId &&
      now - prev.at < 380;
    if (isDoubleTap) {
      setActiveTab("status");
      setPanelOpen(true);
      prevDetectorTapRef.current = null;
      return;
    }
    prevDetectorTapRef.current = { ...selectedDraftDetector, at: now };
  }, [selectedDraftDetector]);

  function addLayer() {
    setLayers((prev) => {
      const layer = newLayer(prev.length + 1);
      setActiveLayerId(layer.id);
      return [...prev, layer];
    });
  }

  function toggleLayer(layerId: string) {
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)));
  }

  function clearActiveLayer() {
    setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, items: [] } : l)));
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
    if (!item || item.type !== "detector") return null;
    return { layer, item };
  }, [layers, selectedDraftDetector]);

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? null,
    [layers, activeLayerId],
  );

  function removeDraftRow(row: DraftPublishRow) {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === row.layerId
          ? { ...layer, items: layer.items.filter((_, idx) => idx !== row.indexInLayer) }
          : layer,
      ),
    );
  }

  function updateSelectedDetectorChecklist(next: Partial<DetectorChecklist>) {
    if (!selectedDraftDetector) return;
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== selectedDraftDetector.layerId) return layer;
        return {
          ...layer,
          items: layer.items.map((item) => {
            if (item.id !== selectedDraftDetector.itemId || item.type !== "detector") return item;
            const current = toChecklist(item.checklist);
            return { ...item, checklist: { ...current, ...next, updatedAt: new Date().toISOString() } };
          }),
        };
      }),
    );
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

  const checklist = selectedDraftDetectorItem
    ? toChecklist(selectedDraftDetectorItem.item.checklist)
    : null;

  return (
    <div className="relative h-full w-full">
      {/* Canvas area */}
      <div className="relative h-full w-full overflow-hidden bg-zinc-950">
        <PaintCanvas
          fileUrl={fileUrl}
          filePath={filePath}
          drawingName={drawingName}
          activeTool={activeTool}
          publishedLayers={publishedLayers}
          draftLayers={layers}
          activeLayerId={activeLayerId}
          onUpdateLayers={setLayers}
          selectedDraftDetector={selectedDraftDetector}
          onSelectDraftDetector={setSelectedDraftDetector}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen((v) => !v)}
        />

        {/* Desktop right-side toolbar */}
        <div className="pointer-events-none absolute right-2 top-14 z-20 hidden sm:block">
          <div className="pointer-events-auto">
            <PaintToolbar
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

        {/* Mobile bottom toolbar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 sm:hidden">
          <div className="pointer-events-auto border-t border-zinc-800 bg-zinc-950/96 backdrop-blur-md">
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
      </div>

      {/* Backdrop */}
      {panelOpen ? (
        <button
          type="button"
          aria-label="Lukk sidepanel"
          onClick={() => setPanelOpen(false)}
          className="absolute inset-0 z-30 bg-transparent"
        />
      ) : null}

      {/* Slide-in side panel */}
      <aside
        className={`absolute right-0 top-0 z-40 flex h-full w-full max-w-[22rem] flex-col border-l border-zinc-800 bg-[#0d0d10] text-zinc-100 shadow-2xl transition-transform duration-300 ease-out ${
          panelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Tab bar */}
        <div className="flex shrink-0 items-stretch justify-between border-b border-zinc-800">
          <div className="flex">
            {(["status", "drafts"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative px-5 py-3.5 text-sm font-semibold tracking-tight transition-colors ${
                  activeTab === tab ? "text-cyan-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "status" ? "Status" : "Utkast"}
                {tab === "drafts" && draftRows.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400">
                    {draftRows.length}
                  </span>
                )}
                {activeTab === tab && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-cyan-400" />
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            title="Lukk"
            className="flex items-center justify-center px-4 text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Active state strip */}
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Verktøy</span>
            <span className="text-xs font-bold text-cyan-300">{activeTool}</span>
          </div>
          {activeLayer && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: activeLayer.color }}
              />
              <span className="text-xs font-semibold text-zinc-200">{activeLayer.name}</span>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ── STATUS TAB ── */}
          {activeTab === "status" && (
            <div className="space-y-5 px-4 py-4">
              {/* Tips */}
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Tips</p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-100/70">
                  Linje-modus: velg en linje og dra i 4 håndtak for å bøye kurven. Trykk på et detektor-punkt i tegningen for å redigere status nedenfor.
                </p>
              </div>

              {/* Detektor-status heading */}
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-zinc-100">Detektor-status</h2>
                <span className="text-xs text-zinc-600">
                  {selectedDraftDetectorItem ? selectedDraftDetectorItem.layer.name : "Velg et punkt"}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Lag</p>
                <div className="flex flex-wrap gap-2">
                  {layers.map((layer) => (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => setActiveLayerId(layer.id)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        activeLayerId === layer.id
                          ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-300"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layer.color }} />
                      {layer.name}
                    </button>
                  ))}
                </div>
              </div>

              {checklist && selectedDraftDetectorItem ? (
                <div className="space-y-3">
                  {/* Checkboxes */}
                  <NeonCheckbox
                    checked={checklist.baseMounted}
                    onChange={(v) => updateSelectedDetectorChecklist({ baseMounted: v })}
                    label="Sokkel montert"
                  />
                  <NeonCheckbox
                    checked={checklist.detectorMounted}
                    onChange={(v) => updateSelectedDetectorChecklist({ detectorMounted: v })}
                    label="Detektor montert"
                  />

                  {/* Kappe */}
                  <div>
                    <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Kappe</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["yes", "no"] as const).map((v) => {
                        const active = checklist.capOn === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateSelectedDetectorChecklist({ capOn: v })}
                            className={`rounded-xl border py-3 text-sm font-semibold transition-all active:scale-[0.97] ${
                              active
                                ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-300 shadow-[inset_0_0_16px_rgba(34,211,238,0.06)]"
                                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                            }`}
                          >
                            {v === "yes" ? "Ja" : "Nei"}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => updateSelectedDetectorChecklist({ capOn: null })}
                        className={`rounded-xl border py-3 text-sm font-semibold transition-all active:scale-[0.97] ${
                          checklist.capOn === null
                            ? "border-zinc-600 bg-zinc-800 text-zinc-300"
                            : "border-zinc-800 bg-zinc-900 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
                        }`}
                      >
                        —
                      </button>
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Kommentar
                    </label>
                    <textarea
                      value={checklist.comment}
                      onChange={(e) => updateSelectedDetectorChecklist({ comment: e.target.value })}
                      rows={3}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-cyan-500/50 focus:outline-none"
                      placeholder="F.eks. Mangler strøm, følger opp..."
                    />
                  </div>

                  {/* Photo */}
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Bildevedlegg
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-xs font-semibold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 active:bg-zinc-800">
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
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-xs font-semibold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 active:bg-zinc-800">
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
                    {checklist.photoDataUrl ? (
                      <img
                        src={checklist.photoDataUrl}
                        alt="Vedlegg"
                        className="mt-3 h-32 w-full rounded-xl border border-zinc-800 object-cover"
                      />
                    ) : (
                      <p className="mt-2 text-center text-xs text-zinc-700">Ingen vedlegg ennå</p>
                    )}
                    {draftError && (
                      <p className="mt-2 text-xs font-semibold text-red-400">{draftError}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-8 text-center">
                  <p className="text-3xl">🔥</p>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                    Trykk på et detektor-punkt<br />i tegningen for å redigere.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── DRAFTS TAB ── */}
          {activeTab === "drafts" && (
            <div className="space-y-4 px-4 py-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-100">Utkast på bruker</h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  Lagres lokalt. Publiser hvert element med ønsket synlighet.
                </p>
              </div>

              {publishError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs font-semibold text-red-400">
                  {publishError}
                </div>
              )}

              {draftRows.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 py-8 text-center">
                  <p className="text-3xl">📋</p>
                  <p className="mt-3 text-sm text-zinc-600">Ingen lokale utkast ennå.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {draftRows.map((row) => (
                    <li key={row.localKey} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3.5">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                          {row.item.type}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.layerColor }} />
                          <span className="text-xs text-zinc-500">{row.layerName}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={visibilityMap[row.localKey] ?? "all"}
                          onChange={(e) =>
                            setVisibilityMap((prev) => ({
                              ...prev,
                              [row.localKey]: e.target.value as OverlayVisibility,
                            }))
                          }
                          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-xs text-zinc-200 focus:border-cyan-500/50 focus:outline-none"
                        >
                          <option value="all">Synlig: alle</option>
                          <option value="admins">Kun admin</option>
                        </select>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => publishOne(row)}
                          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-500/20 disabled:opacity-40"
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
      </aside>
    </div>
  );
}

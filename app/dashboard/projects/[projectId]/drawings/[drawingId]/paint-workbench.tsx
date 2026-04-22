"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  const [mobilePanel, setMobilePanel] = useState<"status" | "drafts">("status");
  const [pending, startTransition] = useTransition();

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
    if (!activeLayerId && layers.length > 0) {
      setActiveLayerId(layers[0].id);
    }
  }, [layers, activeLayerId]);

  useEffect(() => {
    if (layers.length === 0) {
      const fallback = [newLayer(1)];
      setLayers(fallback);
      setActiveLayerId(fallback[0].id);
      return;
    }
    const hasActive = layers.some((l) => l.id === activeLayerId);
    if (!hasActive) {
      setActiveLayerId(layers[0].id);
    }
  }, [layers, activeLayerId]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(layers));
  }, [layers, storageKey]);

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

  function removeDraftRow(row: DraftPublishRow) {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === row.layerId
          ? {
              ...layer,
              items: layer.items.filter((_, idx) => idx !== row.indexInLayer),
            }
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
            return {
              ...item,
              checklist: {
                ...current,
                ...next,
                updatedAt: new Date().toISOString(),
              },
            };
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

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="relative h-[calc(100dvh-11rem)] min-h-[420px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 sm:h-[calc(100dvh-9.5rem)] lg:min-h-[620px]">
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
        />
        <div className="pointer-events-none absolute right-2 top-16 z-20 hidden sm:block">
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
      </div>

      <div className="sm:hidden">
        <PaintToolbar
          mobile
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

      <aside className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-9.5rem)] lg:overflow-auto">
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-1 sm:hidden">
          <button
            type="button"
            onClick={() => setMobilePanel("status")}
            className={`rounded-md px-2 py-1.5 text-xs font-medium ${
              mobilePanel === "status" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Status
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("drafts")}
            className={`rounded-md px-2 py-1.5 text-xs font-medium ${
              mobilePanel === "drafts" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Utkast
          </button>
        </div>

        <section className={`rounded-lg border bg-card p-3 shadow-sm ${mobilePanel === "drafts" ? "hidden sm:block" : ""}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Detektor-status</h2>
            <span className="text-xs text-muted-foreground">
              {selectedDraftDetectorItem ? selectedDraftDetectorItem.layer.name : "Velg et detektor-punkt"}
            </span>
          </div>
          {selectedDraftDetectorItem ? (
            <div className="mt-3 grid gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={toChecklist(selectedDraftDetectorItem.item.checklist).baseMounted}
                  onChange={(e) => updateSelectedDetectorChecklist({ baseMounted: e.target.checked })}
                />
                Sokkel montert
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={toChecklist(selectedDraftDetectorItem.item.checklist).detectorMounted}
                  onChange={(e) => updateSelectedDetectorChecklist({ detectorMounted: e.target.checked })}
                />
                Detektor montert
              </label>
              <div className="space-y-1">
                <p className="text-xs font-medium">Kappe</p>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="capOn"
                      checked={toChecklist(selectedDraftDetectorItem.item.checklist).capOn === "yes"}
                      onChange={() => updateSelectedDetectorChecklist({ capOn: "yes" })}
                    />
                    Ja
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="capOn"
                      checked={toChecklist(selectedDraftDetectorItem.item.checklist).capOn === "no"}
                      onChange={() => updateSelectedDetectorChecklist({ capOn: "no" })}
                    />
                    Nei
                  </label>
                  <button
                    type="button"
                    onClick={() => updateSelectedDetectorChecklist({ capOn: null })}
                    className="rounded border border-input px-1.5 text-xs hover:bg-muted"
                  >
                    Nullstill
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Kommentar</label>
                <textarea
                  value={toChecklist(selectedDraftDetectorItem.item.checklist).comment}
                  onChange={(e) => updateSelectedDetectorChecklist({ comment: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  placeholder="F.eks. Mangler strøm, følger opp i morgen..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Bildevedlegg</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted">
                    Ta bilde
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        void onAttachPhoto(e.target.files?.[0] ?? null);
                        e.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted">
                    Velg fil
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        void onAttachPhoto(e.target.files?.[0] ?? null);
                        e.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mobil: «Ta bilde» åpner kamera direkte. Fungerer for både felt og kontor.
                </p>
                {toChecklist(selectedDraftDetectorItem.item.checklist).photoDataUrl ? (
                  <img
                    src={toChecklist(selectedDraftDetectorItem.item.checklist).photoDataUrl ?? ""}
                    alt="Vedlegg"
                    className="mt-1 h-24 rounded border object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Ingen vedlegg ennå.</p>
                )}
                {toChecklist(selectedDraftDetectorItem.item.checklist).photoPath ? (
                  <p className="text-[11px] text-muted-foreground">Lagringssti settes ved publisering.</p>
                ) : null}
                {draftError ? <p className="text-xs text-destructive">{draftError}</p> : null}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Klikk på et detektor-punkt i tegningen for å redigere status-checklist.
            </p>
          )}
        </section>

        <section className={`rounded-lg border bg-card p-3 shadow-sm ${mobilePanel === "status" ? "hidden sm:block" : ""}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Utkast på bruker</h2>
            <span className="text-xs text-muted-foreground">{draftRows.length} elementer</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Utkast lagres lokalt på bruker. Publiser hvert element med synlighet (default: alle).
          </p>
          {publishError ? (
            <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {publishError}
            </p>
          ) : null}
          {draftRows.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">Ingen lokale utkast ennå.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {draftRows.map((row) => (
                <li key={row.localKey} className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-1.5">
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px]">
                    {row.item.type}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{row.layerName}</span>
                  <select
                    value={visibilityMap[row.localKey] ?? "all"}
                    onChange={(e) =>
                      setVisibilityMap((prev) => ({ ...prev, [row.localKey]: e.target.value as OverlayVisibility }))
                    }
                    className="h-7 rounded border border-input bg-background px-2 text-[11px]"
                  >
                    <option value="all">Synlig: alle</option>
                    <option value="admins">Synlig: kun admin</option>
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => publishOne(row)}
                    className="rounded border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Publiser
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

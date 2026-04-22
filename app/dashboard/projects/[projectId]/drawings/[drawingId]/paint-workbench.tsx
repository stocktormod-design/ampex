"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { publishOverlayItem } from "@/app/dashboard/projects/actions";
import { PaintCanvas } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-canvas";
import { PaintToolbar } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-toolbar";
import type {
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
  const [visibilityMap, setVisibilityMap] = useState<Record<string, OverlayVisibility>>({});
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
    <div className="space-y-3">
      <div className="flex h-[calc(100vh-9.5rem)] min-h-[620px] flex-col overflow-hidden rounded-lg border bg-background lg:flex-row">
        <PaintCanvas
          fileUrl={fileUrl}
          filePath={filePath}
          drawingName={drawingName}
          activeTool={activeTool}
          layers={[...publishedLayers, ...layers]}
          activeLayerId={activeLayerId}
          onUpdateLayers={setLayers}
        />
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

      <section className="rounded-lg border bg-card p-3">
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
    </div>
  );
}

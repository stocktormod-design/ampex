"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { OverlayItem, OverlayLayer, ToolId } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type Props = {
  fileUrl: string;
  filePath: string;
  drawingName: string;
  activeTool: ToolId;
  publishedLayers: OverlayLayer[];
  draftLayers: OverlayLayer[];
  activeLayerId: string;
  onUpdateLayers: (updater: (prev: OverlayLayer[]) => OverlayLayer[]) => void;
  selectedDraftDetector: { layerId: string; itemId: string } | null;
  onSelectDraftDetector: (selection: { layerId: string; itemId: string } | null) => void;
};

function fileExt(path: string): string {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx + 1);
}

const DEFAULT_STAGE = { w: 1400, h: 980 };
const MAX_STAGE_W = 2200;
const MAX_STAGE_H = 1600;

type DraftShape =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | null;

function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  item: OverlayItem,
  color: string,
  isSelectedDetector: boolean,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  if (item.type === "detector") {
    if (isSelectedDetector) {
      ctx.beginPath();
      ctx.arc(item.x, item.y, 13, 0, Math.PI * 2);
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
    }
    ctx.beginPath();
    ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.stroke();
    if (item.label) {
      ctx.fillStyle = "#111827";
      ctx.font = "12px sans-serif";
      ctx.fillText(item.label, item.x + 10, item.y - 10);
    }
    return;
  }

  if (item.type === "line") {
    ctx.beginPath();
    ctx.moveTo(item.x1, item.y1);
    ctx.lineTo(item.x2, item.y2);
    ctx.stroke();
    return;
  }

  if (item.type === "rect") {
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    return;
  }

  if (item.type === "text") {
    ctx.font = "14px sans-serif";
    ctx.fillText(item.text, item.x, item.y);
  }
}

export function PaintCanvas({
  fileUrl,
  filePath,
  drawingName,
  activeTool,
  publishedLayers,
  draftLayers,
  activeLayerId,
  onUpdateLayers,
  selectedDraftDetector,
  onSelectDraftDetector,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [stageSize, setStageSize] = useState(DEFAULT_STAGE);
  const [draft, setDraft] = useState<DraftShape>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ext = fileExt(filePath);
  const isPdf = ext === "pdf";
  const allLayers = useMemo(() => [...publishedLayers, ...draftLayers], [publishedLayers, draftLayers]);
  const activeLayer = useMemo(() => draftLayers.find((l) => l.id === activeLayerId) ?? null, [draftLayers, activeLayerId]);
  const stageW = stageSize.w;
  const stageH = stageSize.h;
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isPdf) {
      setStageSize(DEFAULT_STAGE);
      return;
    }
    const image = new Image();
    image.onload = () => {
      const w = Math.max(700, Math.min(MAX_STAGE_W, image.naturalWidth || DEFAULT_STAGE.w));
      const h = Math.max(500, Math.min(MAX_STAGE_H, image.naturalHeight || DEFAULT_STAGE.h));
      setStageSize({ w, h });
    };
    image.onerror = () => setStageSize(DEFAULT_STAGE);
    image.src = fileUrl;
  }, [fileUrl, isPdf]);

  useEffect(() => {
    const view = viewportRef.current;
    if (!view) return;

    const updateFit = () => {
      const vw = Math.max(320, view.clientWidth - 40);
      const vh = Math.max(220, view.clientHeight - 40);
      const fit = Math.min(vw / stageW, vh / stageH);
      const clamped = Math.max(0.2, Math.min(4, +fit.toFixed(2)));
      setFitZoom(clamped);
      setZoom((prev) => {
        if (Math.abs(prev - 1) < 0.001 || Math.abs(prev - fitZoom) < 0.001) {
          return clamped;
        }
        return prev;
      });
    };

    updateFit();
    const ro = new ResizeObserver(updateFit);
    ro.observe(view);
    return () => ro.disconnect();
  }, [stageW, stageH, fitZoom]);

  function pointerToStage(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * stageW,
      y: ((e.clientY - rect.top) / rect.height) * stageH,
    };
  }

  function addToActive(item: OverlayItem) {
    if (!activeLayer) return;
    onUpdateLayers((prev) =>
      prev.map((layer) => (layer.id === activeLayer.id ? { ...layer, items: [...layer.items, item] } : layer)),
    );
  }

  function findDraftDetectorAt(x: number, y: number) {
    const hitRadius = 12;
    for (const layer of draftLayers) {
      if (!layer.visible) continue;
      for (let i = layer.items.length - 1; i >= 0; i -= 1) {
        const item = layer.items[i];
        if (item.type !== "detector") continue;
        const dx = item.x - x;
        const dy = item.y - y;
        if (Math.hypot(dx, dy) <= hitRadius) {
          return { layerId: layer.id, itemId: item.id };
        }
      }
    }
    return null;
  }

  function eraseLast() {
    if (!activeLayer) return;
    onUpdateLayers((prev) =>
      prev.map((layer) =>
        layer.id === activeLayer.id ? { ...layer, items: layer.items.slice(0, Math.max(0, layer.items.length - 1)) } : layer,
      ),
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, stageW, stageH);

    for (const layer of allLayers) {
      if (!layer.visible) continue;
      for (const item of layer.items) {
        const isSelected =
          item.type === "detector" &&
          selectedDraftDetector?.layerId === layer.id &&
          selectedDraftDetector?.itemId === item.id;
        drawItem(ctx, item, layer.color, Boolean(isSelected));
      }
    }

    if (draft && activeLayer) {
      drawItem(ctx, draft as OverlayItem, activeLayer.color, false);
    }
  }, [allLayers, draft, activeLayer, selectedDraftDetector, stageW, stageH]);

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!activeLayer) return;
    const pt = pointerToStage(e);
    const hitDetector = findDraftDetectorAt(pt.x, pt.y);
    if (hitDetector) {
      onSelectDraftDetector(hitDetector);
      return;
    }
    onSelectDraftDetector(null);

    if (activeTool === "detector") {
      addToActive({
        id: crypto.randomUUID(),
        type: "detector",
        x: pt.x,
        y: pt.y,
        checklist: {
          baseMounted: false,
          detectorMounted: false,
          capOn: null,
          comment: "",
          photoDataUrl: null,
          updatedAt: null,
        },
      });
      return;
    }
    if (activeTool === "text") {
      addToActive({ id: crypto.randomUUID(), type: "text", x: pt.x, y: pt.y, text: "Tekst" });
      return;
    }
    if (activeTool === "erase") {
      eraseLast();
      return;
    }
    if (activeTool === "line" || activeTool === "rect") {
      setDragStart(pt);
      if (activeTool === "line") {
        setDraft({ type: "line", x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
      } else {
        setDraft({ type: "rect", x: pt.x, y: pt.y, w: 0, h: 0 });
      }
    }
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!dragStart) return;
    const pt = pointerToStage(e);
    if (activeTool === "line") {
      setDraft({ type: "line", x1: dragStart.x, y1: dragStart.y, x2: pt.x, y2: pt.y });
      return;
    }
    if (activeTool === "rect") {
      const rect = normalizeRect(dragStart.x, dragStart.y, pt.x, pt.y);
      setDraft({ type: "rect", ...rect });
    }
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    if (!dragStart) return;
    const pt = pointerToStage(e);
    if (activeTool === "line") {
      addToActive({ id: crypto.randomUUID(), type: "line", x1: dragStart.x, y1: dragStart.y, x2: pt.x, y2: pt.y });
    } else if (activeTool === "rect") {
      const rect = normalizeRect(dragStart.x, dragStart.y, pt.x, pt.y);
      addToActive({ id: crypto.randomUUID(), type: "rect", ...rect });
    }
    setDragStart(null);
    setDraft(null);
  }

  return (
    <section className="flex min-h-[72vh] min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2 sm:px-4">
        <div className="min-w-0 max-w-full">
          <p className="truncate text-sm font-medium">{drawingName}</p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{filePath}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
            className="rounded-md border border-input bg-background px-2 py-1 text-[11px] hover:bg-muted sm:text-xs"
          >
            −
          </button>
          <span className="w-12 text-center text-[11px] tabular-nums sm:w-14 sm:text-xs">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
            className="rounded-md border border-input bg-background px-2 py-1 text-[11px] hover:bg-muted sm:text-xs"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md border border-input bg-background px-2 py-1 text-[11px] hover:bg-muted sm:text-xs"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setZoom(fitZoom)}
            className="rounded-md border border-input bg-background px-2 py-1 text-[11px] hover:bg-muted sm:text-xs"
          >
            Fit
          </button>
        </div>
      </div>

      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto bg-muted/30 p-2 sm:p-4">
        <div className="mx-auto w-fit">
          <div
            className="relative overflow-hidden rounded-md border bg-white shadow-sm"
            style={{
              width: `${Math.round(stageW * zoom)}px`,
              height: `${Math.round(stageH * zoom)}px`,
            }}
          >
            {isPdf ? (
              <iframe
                src={`${fileUrl}#view=FitH`}
                title={`Tegning ${drawingName}`}
                className="h-full w-full"
              />
            ) : (
              <img
                src={fileUrl}
                alt={drawingName}
                className="h-full w-full object-fill"
                style={{ imageRendering: "auto", pointerEvents: "none" }}
              />
            )}
            <canvas
              ref={canvasRef}
              width={stageW}
              height={stageH}
              className="absolute inset-0 z-10 h-full w-full cursor-crosshair"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

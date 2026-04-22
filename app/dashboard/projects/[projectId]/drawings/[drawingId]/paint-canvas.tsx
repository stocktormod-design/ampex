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
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.1;

type DraftShape =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | null;

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(3))));
}

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
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [manualZoom, setManualZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [stageSize, setStageSize] = useState(DEFAULT_STAGE);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftShape>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ext = fileExt(filePath);
  const isPdf = ext === "pdf";
  const allLayers = useMemo(() => [...publishedLayers, ...draftLayers], [publishedLayers, draftLayers]);
  const activeLayer = useMemo(() => draftLayers.find((l) => l.id === activeLayerId) ?? null, [draftLayers, activeLayerId]);
  const stageW = stageSize.w;
  const stageH = stageSize.h;
  const zoom = zoomMode === "fit" ? fitZoom : manualZoom;
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadPdfPreview() {
      try {
        setPdfLoadError(null);
        setPdfPreviewUrl(null);

        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error("Kunne ikke hente PDF");
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }
        const task = pdfjs.getDocument({ data: bytes });
        const pdf = await task.promise;
        const page = await pdf.getPage(1);

        const baseViewport = page.getViewport({ scale: 1 });
        const renderViewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Kunne ikke initialisere PDF-canvas");
        }

        await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) {
          throw new Error("Kunne ikke konvertere PDF");
        }

        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPdfPreviewUrl(objectUrl);
        const w = Math.max(400, Math.min(MAX_STAGE_W, Math.round(baseViewport.width)));
        const h = Math.max(300, Math.min(MAX_STAGE_H, Math.round(baseViewport.height)));
        setStageSize({ w, h });
      } catch {
        if (cancelled) return;
        setPdfLoadError("Kunne ikke vise PDF i nettleseren.");
        setStageSize(DEFAULT_STAGE);
      }
    }

    if (isPdf) {
      void loadPdfPreview();
    } else {
      setPdfPreviewUrl(null);
      setPdfLoadError(null);
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        const w = Math.max(700, Math.min(MAX_STAGE_W, image.naturalWidth || DEFAULT_STAGE.w));
        const h = Math.max(500, Math.min(MAX_STAGE_H, image.naturalHeight || DEFAULT_STAGE.h));
        setStageSize({ w, h });
      };
      image.onerror = () => {
        if (cancelled) return;
        setStageSize(DEFAULT_STAGE);
      };
      image.src = fileUrl;
    }

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileUrl, isPdf]);

  useEffect(() => {
    const view = viewportRef.current;
    if (!view) return;

    const updateFit = () => {
      const horizontalPadding = view.clientWidth < 640 ? 16 : 32;
      const verticalPadding = view.clientWidth < 640 ? 16 : 32;
      const vw = Math.max(220, view.clientWidth - horizontalPadding);
      const vh = Math.max(180, view.clientHeight - verticalPadding);
      const fit = Math.min(vw / stageW, vh / stageH);
      const clamped = clampZoom(fit);
      setFitZoom(clamped);
    };

    updateFit();
    const ro = new ResizeObserver(updateFit);
    ro.observe(view);
    return () => ro.disconnect();
  }, [stageW, stageH]);

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

  function increaseZoom() {
    setZoomMode("manual");
    setManualZoom((prev) => clampZoom(Math.max(prev, zoom) + ZOOM_STEP));
  }

  function decreaseZoom() {
    setZoomMode("manual");
    setManualZoom((prev) => clampZoom(Math.max(prev, zoom) - ZOOM_STEP));
  }

  function resetZoom() {
    setZoomMode("manual");
    setManualZoom(1);
  }

  function fitToViewport() {
    setZoomMode("fit");
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-900 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700 bg-zinc-900 px-3 py-2 sm:px-4">
        <div className="min-w-0 max-w-full">
          <p className="truncate text-sm font-medium">{drawingName}</p>
          <p className="hidden truncate text-xs text-zinc-400 sm:block">{filePath}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={decreaseZoom}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] hover:bg-zinc-700 sm:text-xs"
          >
            −
          </button>
          <span className="w-14 text-center text-[11px] tabular-nums sm:text-xs">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={increaseZoom}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] hover:bg-zinc-700 sm:text-xs"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] hover:bg-zinc-700 sm:text-xs"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={fitToViewport}
            className={`rounded-md border px-2 py-1 text-[11px] sm:text-xs ${
              zoomMode === "fit"
                ? "border-blue-400/80 bg-blue-500/20 text-blue-100"
                : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            Fit
          </button>
        </div>
      </div>

      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto bg-zinc-800 p-2 sm:p-4">
        <div className="mx-auto flex min-h-full min-w-full items-center justify-center">
          <div
            className="relative overflow-hidden rounded-md border border-zinc-700 bg-white shadow-xl"
            style={{
              width: `${Math.round(stageW * zoom)}px`,
              height: `${Math.round(stageH * zoom)}px`,
            }}
          >
            {isPdf ? (
              pdfPreviewUrl ? (
                <img
                  src={pdfPreviewUrl}
                  alt={`${drawingName} PDF`}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "auto", pointerEvents: "none" }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-100 p-4 text-center text-sm text-zinc-600">
                  {pdfLoadError ?? "Laster PDF..."}
                </div>
              )
            ) : (
              <img
                src={fileUrl}
                alt={drawingName}
                className="h-full w-full object-contain"
                style={{ imageRendering: "auto", pointerEvents: "none" }}
              />
            )}
            <canvas
              ref={canvasRef}
              width={stageW}
              height={stageH}
              className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none"
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

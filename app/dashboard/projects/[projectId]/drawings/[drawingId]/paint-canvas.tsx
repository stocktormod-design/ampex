"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type TouchEvent } from "react";
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

type Bounds = { x: number; y: number; w: number; h: number };

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(3))));
}

function detectContentBounds(canvas: HTMLCanvasElement): Bounds | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      const isNotWhite = a > 0 && (r < 245 || g < 245 || b < 245);
      if (!isNotWhite) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w < 40 || h < 40) return null;
  return { x: minX, y: minY, w, h };
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
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("manual");
  const [manualZoom, setManualZoom] = useState(1.5);
  const [fitZoom, setFitZoom] = useState(1);
  const [stageSize, setStageSize] = useState(DEFAULT_STAGE);
  const [docOffset, setDocOffset] = useState({ x: 0, y: 0 });
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftShape>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [touchStart, setTouchStart] = useState<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);
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
        const renderCanvas = document.createElement("canvas");
        renderCanvas.width = Math.ceil(renderViewport.width);
        renderCanvas.height = Math.ceil(renderViewport.height);
        const ctx = renderCanvas.getContext("2d");
        if (!ctx) {
          throw new Error("Kunne ikke initialisere PDF-canvas");
        }

        await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
        const bounds = detectContentBounds(renderCanvas);
        const sourceBounds = bounds ?? { x: 0, y: 0, w: renderCanvas.width, h: renderCanvas.height };

        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = sourceBounds.w;
        croppedCanvas.height = sourceBounds.h;
        const croppedCtx = croppedCanvas.getContext("2d");
        if (!croppedCtx) {
          throw new Error("Kunne ikke beskjære PDF");
        }
        croppedCtx.drawImage(
          renderCanvas,
          sourceBounds.x,
          sourceBounds.y,
          sourceBounds.w,
          sourceBounds.h,
          0,
          0,
          sourceBounds.w,
          sourceBounds.h,
        );

        const blob = await new Promise<Blob | null>((resolve) => croppedCanvas.toBlob(resolve, "image/png"));
        if (!blob) {
          throw new Error("Kunne ikke konvertere PDF");
        }

        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPdfPreviewUrl(objectUrl);
        const w = Math.max(320, Math.min(MAX_STAGE_W, Math.round(sourceBounds.w / 2)));
        const h = Math.max(220, Math.min(MAX_STAGE_H, Math.round(sourceBounds.h / 2)));
        setStageSize({ w, h });
        setDocOffset({ x: sourceBounds.x / 2, y: sourceBounds.y / 2 });
      } catch {
        if (cancelled) return;
        setPdfLoadError("Kunne ikke vise PDF i nettleseren.");
        setStageSize(DEFAULT_STAGE);
        setDocOffset({ x: 0, y: 0 });
      }
    }

    if (isPdf) {
      void loadPdfPreview();
    } else {
      setPdfPreviewUrl(null);
      setPdfLoadError(null);
      setDocOffset({ x: 0, y: 0 });
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
      const isMobileViewport = view.clientWidth < 640;
      const horizontalPadding = isMobileViewport ? 0 : 32;
      const verticalPadding = isMobileViewport ? 0 : 32;
      const vw = Math.max(220, view.clientWidth - horizontalPadding);
      const vh = Math.max(180, view.clientHeight - verticalPadding);
      const fit = isMobileViewport ? Math.max(vw / stageW, vh / stageH) : Math.min(vw / stageW, vh / stageH);
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

  function toDocPoint(pt: { x: number; y: number }) {
    return { x: pt.x + docOffset.x, y: pt.y + docOffset.y };
  }

  function toDisplayItem(item: OverlayItem): OverlayItem {
    if (docOffset.x === 0 && docOffset.y === 0) return item;
    if (item.type === "detector") return { ...item, x: item.x - docOffset.x, y: item.y - docOffset.y };
    if (item.type === "line") {
      return {
        ...item,
        x1: item.x1 - docOffset.x,
        y1: item.y1 - docOffset.y,
        x2: item.x2 - docOffset.x,
        y2: item.y2 - docOffset.y,
      };
    }
    if (item.type === "rect") return { ...item, x: item.x - docOffset.x, y: item.y - docOffset.y };
    return { ...item, x: item.x - docOffset.x, y: item.y - docOffset.y };
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
        const displayX = item.x - docOffset.x;
        const displayY = item.y - docOffset.y;
        const dx = displayX - x;
        const dy = displayY - y;
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
        const displayItem = toDisplayItem(item);
        const isSelected =
          item.type === "detector" &&
          selectedDraftDetector?.layerId === layer.id &&
          selectedDraftDetector?.itemId === item.id;
        drawItem(ctx, displayItem, layer.color, Boolean(isSelected));
      }
    }

    if (draft && activeLayer) {
      drawItem(ctx, toDisplayItem(draft as OverlayItem), activeLayer.color, false);
    }
  }, [allLayers, draft, activeLayer, selectedDraftDetector, stageW, stageH, docOffset.x, docOffset.y]);

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!activeLayer) return;
    
    if (activeTool === "select") {
      const pt = pointerToStage(e);
      const hitDetector = findDraftDetectorAt(pt.x, pt.y);
      if (hitDetector) {
        onSelectDraftDetector(hitDetector);
        return;
      }
      onSelectDraftDetector(null);
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const pt = pointerToStage(e);
    const docPt = toDocPoint(pt);
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
        x: docPt.x,
        y: docPt.y,
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
      addToActive({ id: crypto.randomUUID(), type: "text", x: docPt.x, y: docPt.y, text: "Tekst" });
      return;
    }
    if (activeTool === "erase") {
      eraseLast();
      return;
    }
    if (activeTool === "line" || activeTool === "rect") {
      setDragStart(docPt);
      if (activeTool === "line") {
        setDraft({ type: "line", x1: docPt.x, y1: docPt.y, x2: docPt.x, y2: docPt.y });
      } else {
        setDraft({ type: "rect", x: docPt.x, y: docPt.y, w: 0, h: 0 });
      }
    }
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (isPanning && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!dragStart) return;
    const docPt = toDocPoint(pointerToStage(e));
    if (activeTool === "line") {
      setDraft({ type: "line", x1: dragStart.x, y1: dragStart.y, x2: docPt.x, y2: docPt.y });
      return;
    }
    if (activeTool === "rect") {
      const rect = normalizeRect(dragStart.x, dragStart.y, docPt.x, docPt.y);
      setDraft({ type: "rect", ...rect });
    }
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    if (isPanning) {
      setIsPanning(false);
      setDragStart(null);
      return;
    }

    if (!dragStart) return;
    const docPt = toDocPoint(pointerToStage(e));
    if (activeTool === "line") {
      addToActive({ id: crypto.randomUUID(), type: "line", x1: dragStart.x, y1: dragStart.y, x2: docPt.x, y2: docPt.y });
    } else if (activeTool === "rect") {
      const rect = normalizeRect(dragStart.x, dragStart.y, docPt.x, docPt.y);
      addToActive({ id: crypto.randomUUID(), type: "rect", ...rect });
    }
    setDragStart(null);
    setDraft(null);
  }

  function onTouchStart(e: TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cx = (t0.clientX + t1.clientX) / 2;
      const cy = (t0.clientY + t1.clientY) / 2;
      setTouchStart({ dist, zoom: manualZoom, cx, cy });
      setZoomMode("manual");
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      setDragStart({ x: t.clientX, y: t.clientY });
      setIsPanning(activeTool === "select");
    }
  }

  function onTouchMove(e: TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length === 2 && touchStart) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / touchStart.dist;
      const newZoom = clampZoom(touchStart.zoom * scale);
      setManualZoom(newZoom);
    } else if (e.touches.length === 1 && dragStart && (isPanning || activeTool === "select")) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - dragStart.x;
      const dy = t.clientY - dragStart.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: t.clientX, y: t.clientY });
    }
  }

  function onTouchEnd(e: TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length < 2) {
      setTouchStart(null);
    }
    if (e.touches.length === 0) {
      setDragStart(null);
      setIsPanning(false);
    }
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

      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-zinc-800 p-0 sm:p-4">
        <div className="mx-auto flex min-h-full min-w-full items-start justify-start sm:items-center sm:justify-center">
          <div
            className="relative overflow-hidden rounded-md border border-zinc-700 bg-white shadow-xl"
            style={{
              width: `${Math.round(stageW * zoom)}px`,
              height: `${Math.round(stageH * zoom)}px`,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
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
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-100 p-4 text-center text-sm text-zinc-600">
                  <p>{pdfLoadError ?? "Laster PDF..."}</p>
                  {pdfLoadError ? (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Åpne PDF
                    </a>
                  ) : null}
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
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

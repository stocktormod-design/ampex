"use client";

import { useEffect, useRef, useState } from "react";
import type { PublishedOverlay } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type Props = {
  fileUrl: string;
  filePath: string;
  drawingName: string;
  overlays: PublishedOverlay[];
};

const DEFAULT_STAGE = { w: 1400, h: 980 };
const MAX_STAGE_W = 2200;
const MAX_STAGE_H = 1600;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.1;
type Bounds = { x: number; y: number; w: number; h: number };

function fileExt(path: string): string {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx + 1);
}

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

const OVERLAY_STAGE = { w: 1400, h: 980 };

function OverlaySvg({ overlays }: { overlays: PublishedOverlay[] }) {
  return (
    <svg
      viewBox={`0 0 ${OVERLAY_STAGE.w} ${OVERLAY_STAGE.h}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {overlays.map((o) => {
        const p = o.payload;
        const color = o.layerColor;
        if (p.type === "detector") {
          return (
            <g key={o.id}>
              <circle cx={p.x} cy={p.y} r={13} fill="none" stroke={color} strokeWidth={2.5} />
              <circle cx={p.x} cy={p.y} r={5} fill={color} />
            </g>
          );
        }
        if (p.type === "point") {
          return (
            <g key={o.id}>
              <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={color} strokeWidth={2.5} />
              <circle cx={p.x} cy={p.y} r={3} fill={color} />
            </g>
          );
        }
        if (p.type === "line") {
          const d =
            p.c1x != null && p.c1y != null && p.c2x != null && p.c2y != null
              ? `M${p.x1},${p.y1} C${p.c1x},${p.c1y} ${p.c2x},${p.c2y} ${p.x2},${p.y2}`
              : `M${p.x1},${p.y1} L${p.x2},${p.y2}`;
          return <path key={o.id} d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
        }
        if (p.type === "rect") {
          return (
            <rect
              key={o.id}
              x={Math.min(p.x, p.x + p.w)}
              y={Math.min(p.y, p.y + p.h)}
              width={Math.abs(p.w)}
              height={Math.abs(p.h)}
              fill={`${color}22`}
              stroke={color}
              strokeWidth={2.5}
            />
          );
        }
        if (p.type === "text") {
          return (
            <text
              key={o.id}
              x={p.x}
              y={p.y}
              fill={color}
              fontSize={18}
              fontFamily="sans-serif"
              fontWeight="600"
            >
              {p.text}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}

export function DrawingViewerCanvas({ fileUrl, filePath, drawingName, overlays }: Props) {
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("manual");
  const [manualZoom, setManualZoom] = useState(1.5);
  const [fitZoom, setFitZoom] = useState(1);
  const [stageSize, setStageSize] = useState(DEFAULT_STAGE);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState<{ dist: number; zoom: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isPdf = fileExt(filePath) === "pdf";
  const zoom = zoomMode === "fit" ? fitZoom : manualZoom;

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
      const isMobileViewport = view.clientWidth < 640;
      const horizontalPadding = isMobileViewport ? 0 : 32;
      const verticalPadding = isMobileViewport ? 0 : 32;
      const vw = Math.max(220, view.clientWidth - horizontalPadding);
      const vh = Math.max(180, view.clientHeight - verticalPadding);
      const fit = isMobileViewport ? Math.max(vw / stageSize.w, vh / stageSize.h) : Math.min(vw / stageSize.w, vh / stageSize.h);
      setFitZoom(clampZoom(fit));
    };

    updateFit();
    const ro = new ResizeObserver(updateFit);
    ro.observe(view);
    return () => ro.disconnect();
  }, [stageSize.w, stageSize.h]);

  function increaseZoom() {
    setZoomMode("manual");
    setManualZoom((prev) => clampZoom(Math.max(prev, zoom) + ZOOM_STEP));
  }

  function decreaseZoom() {
    setZoomMode("manual");
    setManualZoom((prev) => clampZoom(Math.max(prev, zoom) - ZOOM_STEP));
  }

  function fitToViewport() {
    setZoomMode("fit");
    setPanOffset({ x: 0, y: 0 });
  }

  function resetView() {
    setZoomMode("manual");
    setManualZoom(1.5);
    setPanOffset({ x: 0, y: 0 });
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setTouchStart({ dist, zoom: manualZoom });
      setZoomMode("manual");
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      setDragStart({ x: t.clientX, y: t.clientY });
    }
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
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
    } else if (e.touches.length === 1 && dragStart) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - dragStart.x;
      const dy = t.clientY - dragStart.y;
      setPanOffset((p) => ({ x: p.x + dx, y: p.y + dy }));
      setDragStart({ x: t.clientX, y: t.clientY });
    }
  }

  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length < 2) {
      setTouchStart(null);
    }
    if (e.touches.length === 0) {
      setDragStart(null);
    }
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoomMode("manual");
    setManualZoom((prev) => clampZoom(prev + delta));
  }

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-zinc-900 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700 bg-zinc-900 px-3 py-2 sm:px-4">
        <div className="min-w-0 max-w-full">
          <p className="truncate text-sm font-medium">{drawingName}</p>
          <p className="hidden truncate text-xs text-zinc-400 sm:block">{filePath}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={decreaseZoom}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium hover:bg-zinc-700 sm:text-xs"
            title="Zoom ut"
          >
            −
          </button>
          <span className="w-14 text-center text-[11px] font-medium tabular-nums sm:text-xs">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={increaseZoom}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium hover:bg-zinc-700 sm:text-xs"
            title="Zoom inn"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] font-medium hover:bg-zinc-700 sm:text-xs"
            title="Tilbakestill visning (1.5x)"
          >
            ⌖
          </button>
          <button
            type="button"
            onClick={fitToViewport}
            className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium sm:text-xs ${
              zoomMode === "fit"
                ? "border-blue-400/80 bg-blue-500/20 text-blue-100"
                : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
            }`}
            title="Tilpass vindu"
          >
            Fit
          </button>
        </div>
      </div>

      <div 
        ref={viewportRef} 
        className="relative min-h-0 flex-1 overflow-auto bg-zinc-800 p-0 sm:p-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        <div 
          className="relative mx-auto flex min-h-full min-w-full items-start justify-start sm:items-center sm:justify-center"
          style={{ 
            minWidth: `${Math.round(stageSize.w * zoom + Math.abs(panOffset.x) * 2)}px`,
            minHeight: `${Math.round(stageSize.h * zoom + Math.abs(panOffset.y) * 2)}px`
          }}
        >
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-md border border-zinc-700 bg-white shadow-xl"
            style={{
              width: `${Math.round(stageSize.w * zoom)}px`,
              height: `${Math.round(stageSize.h * zoom)}px`,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            }}
          >
            {isPdf ? (
              pdfPreviewUrl ? (
                <>
                  <img
                    src={pdfPreviewUrl}
                    alt={`${drawingName} PDF`}
                    className="h-full w-full object-contain"
                    style={{ imageRendering: "auto" }}
                  />
                  {overlays.length > 0 && <OverlaySvg overlays={overlays} />}
                </>
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
              <>
                <img
                  src={fileUrl}
                  alt={drawingName}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "auto" }}
                />
                {overlays.length > 0 && <OverlaySvg overlays={overlays} />}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

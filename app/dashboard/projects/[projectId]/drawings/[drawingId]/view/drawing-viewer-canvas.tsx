"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  fileUrl: string;
  filePath: string;
  drawingName: string;
};

const DEFAULT_STAGE = { w: 1400, h: 980 };
const MAX_STAGE_W = 2200;
const MAX_STAGE_H = 1600;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.1;

function fileExt(path: string): string {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx + 1);
}

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(3))));
}

export function DrawingViewerCanvas({ fileUrl, filePath, drawingName }: Props) {
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [manualZoom, setManualZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [stageSize, setStageSize] = useState(DEFAULT_STAGE);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isPdf = fileExt(filePath) === "pdf";
  const zoom = zoomMode === "fit" ? fitZoom : manualZoom;

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
      const horizontalPadding = view.clientWidth < 640 ? 16 : 32;
      const verticalPadding = view.clientWidth < 640 ? 16 : 32;
      const vw = Math.max(220, view.clientWidth - horizontalPadding);
      const vh = Math.max(180, view.clientHeight - verticalPadding);
      const fit = Math.min(vw / stageSize.w, vh / stageSize.h);
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

  function resetZoom() {
    setZoomMode("manual");
    setManualZoom(1);
  }

  function fitToViewport() {
    setZoomMode("fit");
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
              width: `${Math.round(stageSize.w * zoom)}px`,
              height: `${Math.round(stageSize.h * zoom)}px`,
            }}
          >
            {isPdf ? (
              <iframe
                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                title={`Tegning ${drawingName}`}
                className="h-full w-full"
              />
            ) : (
              <img
                src={fileUrl}
                alt={drawingName}
                className="h-full w-full object-contain"
                style={{ imageRendering: "auto" }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

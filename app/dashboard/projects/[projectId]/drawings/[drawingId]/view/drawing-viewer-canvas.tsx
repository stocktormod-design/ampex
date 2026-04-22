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
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
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
              pdfPreviewUrl ? (
                <img
                  src={pdfPreviewUrl}
                  alt={`${drawingName} PDF`}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "auto" }}
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
                style={{ imageRendering: "auto" }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

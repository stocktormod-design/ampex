"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, AlertCircle } from "lucide-react";

type Props = { pdfUrl: string };

// Minimal types for pdfjs
type PDFDocumentProxy = {
  numPages: number;
  getPage: (n: number) => Promise<PDFPageProxy>;
};
type PDFPageProxy = {
  getViewport: (opts: { scale: number }) => PDFViewport;
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }) => PDFRenderTask;
};
type PDFViewport = { width: number; height: number };
type PDFRenderTask = { promise: Promise<void>; cancel: () => void };

export function ProtocolViewer({ pdfUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<PDFRenderTask | null>(null);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document once
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(pdfUrl);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const bytes = new Uint8Array(await res.arrayBuffer());

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }

        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;

        setPdf(doc as unknown as PDFDocumentProxy);
        setNumPages(doc.numPages);
      } catch {
        if (!cancelled) setError("Kunne ikke laste PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfUrl]);

  // Render current page whenever pdf/page/scale changes
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;

    // Cancel any in-flight render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    setRendering(true);
    try {
      const pdfPage = await pdf.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const task = pdfPage.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch {
      // cancelled or failed — ignore
    } finally {
      setRendering(false);
    }
  }, [pdf, page, scale]);

  useEffect(() => { renderPage(); }, [renderPage]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Laster PDF…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <AlertCircle className="size-8 text-muted-foreground/50" aria-hidden />
        <p className="text-sm text-muted-foreground">{error}</p>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="size-4" />
          Last ned PDF
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-background/80 px-3 py-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background transition-colors hover:bg-muted"
            aria-label="Zoom ut"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="min-w-[3.5rem] text-center text-xs font-mono text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background transition-colors hover:bg-muted"
            aria-label="Zoom inn"
          >
            <ZoomIn className="size-3.5" />
          </button>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background transition-colors hover:bg-muted disabled:opacity-40"
            aria-label="Forrige side"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[5rem] text-center text-xs font-mono text-muted-foreground">
            {page} / {numPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-background transition-colors hover:bg-muted disabled:opacity-40"
            aria-label="Neste side"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        className="relative overflow-auto bg-zinc-100 p-4 dark:bg-zinc-900"
        style={{ maxHeight: "75vh" }}
      >
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="max-w-full rounded shadow-md"
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  pdfUrl: string;
};

export function ProtocolViewer({ pdfUrl }: Props) {
  const [useEmbed, setUseEmbed] = useState(true);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  if (useEmbed) {
    return (
      <div className="relative bg-zinc-100 dark:bg-zinc-900">
        {/* Controls bar */}
        <div className="flex items-center justify-between border-b border-border bg-background/80 px-4 py-2 text-xs backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
              className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background transition-colors hover:bg-muted"
              aria-label="Zoom ut"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="min-w-[3rem] text-center font-mono text-muted-foreground">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background transition-colors hover:bg-muted"
              aria-label="Zoom inn"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setUseEmbed(false)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Vis ikke PDF? Åpne i ny fane
          </button>
        </div>

        {/* Embedded PDF */}
        <div className="overflow-auto" style={{ maxHeight: "75vh" }}>
          <iframe
            src={`${pdfUrl}#page=${page}&zoom=${zoom}`}
            title="PDF-visning"
            className="w-full border-0"
            style={{ height: "75vh", minHeight: "500px" }}
            onError={() => setUseEmbed(false)}
          />
        </div>

        {/* Page controls */}
        <div className="flex items-center justify-center gap-3 border-t border-border bg-background/80 py-2 text-xs">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background transition-colors hover:bg-muted disabled:opacity-40"
            aria-label="Forrige side"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="font-mono text-muted-foreground">Side {page}</span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background transition-colors hover:bg-muted"
            aria-label="Neste side"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10">
      <p className="text-sm text-muted-foreground">
        PDF-forhåndsvisning er ikke tilgjengelig i denne nettleseren.
      </p>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Åpne PDF i ny fane
      </a>
    </div>
  );
}

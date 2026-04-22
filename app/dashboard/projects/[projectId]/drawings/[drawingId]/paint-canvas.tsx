"use client";

import { useState } from "react";

type Props = {
  fileUrl: string;
  filePath: string;
  drawingName: string;
};

function fileExt(path: string): string {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx + 1);
}

export function PaintCanvas({ fileUrl, filePath, drawingName }: Props) {
  const [zoom, setZoom] = useState(1);
  const ext = fileExt(filePath);
  const isPdf = ext === "pdf";

  return (
    <section className="flex min-h-[72vh] min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{drawingName}</p>
          <p className="truncate text-xs text-muted-foreground">{filePath}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
          >
            −
          </button>
          <span className="w-14 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-muted/30 p-6">
        <div
          className="mx-auto w-fit origin-top transition-transform"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        >
          {isPdf ? (
            <iframe
              src={`${fileUrl}#view=FitH`}
              title={`Tegning ${drawingName}`}
              className="h-[80vh] w-[min(1100px,80vw)] rounded-md border bg-white shadow-sm"
            />
          ) : (
            <img
              src={fileUrl}
              alt={drawingName}
              className="max-h-[80vh] max-w-[min(1100px,80vw)] rounded-md border bg-white object-contain shadow-sm"
            />
          )}
        </div>
      </div>
    </section>
  );
}

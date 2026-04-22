"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { OverlayItem, OverlayLayer, ToolId } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type Props = {
  fileUrl: string;
  filePath: string;
  drawingName: string;
  activeTool: ToolId;
  layers: OverlayLayer[];
  activeLayerId: string;
  onUpdateLayers: (updater: (prev: OverlayLayer[]) => OverlayLayer[]) => void;
};

function fileExt(path: string): string {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx + 1);
}

const STAGE_W = 1100;
const STAGE_H = 780;

type DraftShape =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | null;

function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

function drawItem(ctx: CanvasRenderingContext2D, item: OverlayItem, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  if (item.type === "detector") {
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

export function PaintCanvas({ fileUrl, filePath, drawingName, activeTool, layers, activeLayerId, onUpdateLayers }: Props) {
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<DraftShape>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ext = fileExt(filePath);
  const isPdf = ext === "pdf";
  const activeLayer = useMemo(() => layers.find((l) => l.id === activeLayerId) ?? null, [layers, activeLayerId]);

  function pointerToStage(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * STAGE_W,
      y: ((e.clientY - rect.top) / rect.height) * STAGE_H,
    };
  }

  function addToActive(item: OverlayItem) {
    if (!activeLayer) return;
    onUpdateLayers((prev) =>
      prev.map((layer) => (layer.id === activeLayer.id ? { ...layer, items: [...layer.items, item] } : layer)),
    );
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
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);

    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const item of layer.items) {
        drawItem(ctx, item, layer.color);
      }
    }

    if (draft && activeLayer) {
      drawItem(ctx, draft as OverlayItem, activeLayer.color);
    }
  }, [layers, draft, activeLayer]);

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!activeLayer) return;
    const pt = pointerToStage(e);

    if (activeTool === "detector") {
      addToActive({ id: crypto.randomUUID(), type: "detector", x: pt.x, y: pt.y });
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
          <div className="relative h-[780px] w-[1100px] overflow-hidden rounded-md border bg-white shadow-sm">
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
                className="h-full w-full object-contain"
              />
            )}
            <canvas
              ref={canvasRef}
              width={STAGE_W}
              height={STAGE_H}
              className="absolute inset-0 h-full w-full cursor-crosshair"
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

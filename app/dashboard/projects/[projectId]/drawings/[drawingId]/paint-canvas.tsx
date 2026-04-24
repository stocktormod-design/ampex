"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type TouchEvent, type WheelEvent } from "react";
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
  panelOpen?: boolean;
  onTogglePanel?: () => void;
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
const ZOOM_STEP = 0.25;

type DraftShape =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; c1x: number; c1y: number; c2x: number; c2y: number }
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

type LinePoints = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
};

type LineHandle = "start" | "end" | "c1" | "c2";
type ItemSelection = { layerId: string; itemId: string };

function linePoints(item: Extract<OverlayItem, { type: "line" }>): LinePoints {
  const c1x = item.c1x ?? item.x1 + (item.x2 - item.x1) * 0.33;
  const c1y = item.c1y ?? item.y1 + (item.y2 - item.y1) * 0.33;
  const c2x = item.c2x ?? item.x1 + (item.x2 - item.x1) * 0.67;
  const c2y = item.c2y ?? item.y1 + (item.y2 - item.y1) * 0.67;
  return { x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2, c1x, c1y, c2x, c2y };
}

function bezierPoint(t: number, pts: LinePoints) {
  const mt = 1 - t;
  const x =
    mt ** 3 * pts.x1 + 3 * mt ** 2 * t * pts.c1x + 3 * mt * t ** 2 * pts.c2x + t ** 3 * pts.x2;
  const y =
    mt ** 3 * pts.y1 + 3 * mt ** 2 * t * pts.c1y + 3 * mt * t ** 2 * pts.c2y + t ** 3 * pts.y2;
  return { x, y };
}

function distancePointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
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
    // Green when cap is confirmed off (detector is operational)
    const fillColor = item.checklist?.capOn === "no" ? "#22c55e" : color;
    if (isSelectedDetector) {
      ctx.beginPath();
      ctx.arc(item.x, item.y, 13, 0, Math.PI * 2);
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.lineWidth = 2;
    }
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = fillColor;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 2;
    if (item.label) {
      ctx.fillStyle = "#111827";
      ctx.font = "12px sans-serif";
      ctx.fillText(item.label, item.x + 10, item.y - 10);
    }
    return;
  }

  if (item.type === "line") {
    const pts = linePoints(item);
    ctx.beginPath();
    ctx.moveTo(pts.x1, pts.y1);
    ctx.bezierCurveTo(pts.c1x, pts.c1y, pts.c2x, pts.c2y, pts.x2, pts.y2);
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
  panelOpen,
  onTogglePanel,
}: Props) {
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [manualZoom, setManualZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [stageSize, setStageSize] = useState(DEFAULT_STAGE);
  const [docOffset, setDocOffset] = useState({ x: 0, y: 0 });
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftShape>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [touchStart, setTouchStart] = useState<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);
  const [selectedDraftItem, setSelectedDraftItem] = useState<ItemSelection | null>(null);
  const [selectedDraftLine, setSelectedDraftLine] = useState<ItemSelection | null>(null);
  const [dragLineHandle, setDragLineHandle] = useState<{ layerId: string; itemId: string; handle: LineHandle } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ext = fileExt(filePath);
  const isPdf = ext === "pdf";
  const allLayers = useMemo(() => [...publishedLayers, ...draftLayers], [publishedLayers, draftLayers]);
  const activeLayer = useMemo(() => draftLayers.find((l) => l.id === activeLayerId) ?? null, [draftLayers, activeLayerId]);
  const stageW = stageSize.w;
  const stageH = stageSize.h;
  const zoom = zoomMode === "fit" ? fitZoom : manualZoom;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchPanStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchTapStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initializedFitRef = useRef(false);
  const canvasCursor = isPanning ? "cursor-grabbing" : activeTool === "select" || dragLineHandle ? "cursor-grab" : "cursor-crosshair";

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    initializedFitRef.current = false;
    setPanOffset({ x: 0, y: 0 });

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
    if (initializedFitRef.current) return;
    const view = viewportRef.current;
    if (!view || fitZoom <= 0) return;
    setZoomMode("fit");
    setManualZoom(fitZoom);
    setPanOffset({ x: 0, y: 0 });
    initializedFitRef.current = true;
  }, [fitZoom]);

  useEffect(() => {
    const view = viewportRef.current;
    if (!view) return;

    const updateFit = () => {
      const horizontalPadding = 0;
      const verticalPadding = 0;
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

  useEffect(() => {
    setPanOffset((prev) => clampPan(prev, zoom));
  }, [zoom, stageW, stageH]);

  function pointerToStage(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * stageW,
      y: ((e.clientY - rect.top) / rect.height) * stageH,
    };
  }

  function touchToStage(touch: { clientX: number; clientY: number }) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((touch.clientX - rect.left) / rect.width) * stageW,
      y: ((touch.clientY - rect.top) / rect.height) * stageH,
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
        c1x: (item.c1x ?? item.x1 + (item.x2 - item.x1) * 0.33) - docOffset.x,
        c1y: (item.c1y ?? item.y1 + (item.y2 - item.y1) * 0.33) - docOffset.y,
        c2x: (item.c2x ?? item.x1 + (item.x2 - item.x1) * 0.67) - docOffset.x,
        c2y: (item.c2y ?? item.y1 + (item.y2 - item.y1) * 0.67) - docOffset.y,
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

  function findDraftLineAt(x: number, y: number) {
    const maxDistance = 10;
    for (const layer of draftLayers) {
      if (!layer.visible) continue;
      for (let i = layer.items.length - 1; i >= 0; i -= 1) {
        const item = layer.items[i];
        if (item.type !== "line") continue;
        const display = toDisplayItem(item) as Extract<OverlayItem, { type: "line" }>;
        const pts = linePoints(display);
        let minDistance = Number.POSITIVE_INFINITY;
        let prev = bezierPoint(0, pts);
        for (let t = 0.05; t <= 1; t += 0.05) {
          const next = bezierPoint(t, pts);
          minDistance = Math.min(minDistance, distancePointToSegment(x, y, prev.x, prev.y, next.x, next.y));
          prev = next;
        }
        if (minDistance <= maxDistance) {
          return { layerId: layer.id, itemId: item.id };
        }
      }
    }
    return null;
  }

  function findDraftItemAt(x: number, y: number): ItemSelection | null {
    const detectorHit = findDraftDetectorAt(x, y);
    if (detectorHit) return detectorHit;

    for (const layer of draftLayers) {
      if (!layer.visible) continue;
      for (let i = layer.items.length - 1; i >= 0; i -= 1) {
        const item = layer.items[i];
        if (item.type === "line") continue;
        const display = toDisplayItem(item);
        if (display.type === "rect") {
          if (x >= display.x && x <= display.x + display.w && y >= display.y && y <= display.y + display.h) {
            return { layerId: layer.id, itemId: item.id };
          }
        } else if (display.type === "text") {
          const approxWidth = Math.max(40, display.text.length * 8);
          const approxHeight = 18;
          if (x >= display.x && x <= display.x + approxWidth && y >= display.y - approxHeight && y <= display.y + 4) {
            return { layerId: layer.id, itemId: item.id };
          }
        }
      }
    }

    return findDraftLineAt(x, y);
  }

  function selectItem(selection: ItemSelection | null) {
    setSelectedDraftItem(selection);
    if (!selection) {
      setSelectedDraftLine(null);
      onSelectDraftDetector(null);
      return;
    }
    const layer = draftLayers.find((l) => l.id === selection.layerId);
    const item = layer?.items.find((i) => i.id === selection.itemId);
    if (!item) return;
    if (item.type === "detector") {
      onSelectDraftDetector(selection);
      setSelectedDraftLine(null);
    } else if (item.type === "line") {
      setSelectedDraftLine(selection);
      onSelectDraftDetector(null);
    } else {
      setSelectedDraftLine(null);
      onSelectDraftDetector(null);
    }
  }

  function deleteSelectedItem() {
    if (!selectedDraftItem) return;
    onUpdateLayers((prev) =>
      prev.map((layer) =>
        layer.id === selectedDraftItem.layerId
          ? { ...layer, items: layer.items.filter((item) => item.id !== selectedDraftItem.itemId) }
          : layer,
      ),
    );
    setSelectedDraftItem(null);
    setSelectedDraftLine(null);
    onSelectDraftDetector(null);
    setDragLineHandle(null);
  }

  function getSelectedLineWithPoints() {
    if (!selectedDraftLine) return null;
    const layer = draftLayers.find((l) => l.id === selectedDraftLine.layerId);
    if (!layer) return null;
    const item = layer.items.find((i) => i.id === selectedDraftLine.itemId);
    if (!item || item.type !== "line") return null;
    const display = toDisplayItem(item) as Extract<OverlayItem, { type: "line" }>;
    return { layerId: layer.id, itemId: item.id, item, points: linePoints(display) };
  }

  function findLineHandleAt(x: number, y: number) {
    const selected = getSelectedLineWithPoints();
    if (!selected) return null;
    const p = selected.points;
    const handles: Array<{ handle: LineHandle; x: number; y: number }> = [
      { handle: "start", x: p.x1, y: p.y1 },
      { handle: "c1", x: p.c1x, y: p.c1y },
      { handle: "c2", x: p.c2x, y: p.c2y },
      { handle: "end", x: p.x2, y: p.y2 },
    ];
    const hit = handles.find((h) => Math.hypot(h.x - x, h.y - y) <= 11);
    if (!hit) return null;
    return { layerId: selected.layerId, itemId: selected.itemId, handle: hit.handle };
  }

  function updateLineHandle(selection: { layerId: string; itemId: string; handle: LineHandle }, docPt: { x: number; y: number }) {
    onUpdateLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== selection.layerId) return layer;
        return {
          ...layer,
          items: layer.items.map((item) => {
            if (item.id !== selection.itemId || item.type !== "line") return item;
            const next = { ...item };
            if (selection.handle === "start") {
              next.x1 = docPt.x;
              next.y1 = docPt.y;
            } else if (selection.handle === "end") {
              next.x2 = docPt.x;
              next.y2 = docPt.y;
            } else if (selection.handle === "c1") {
              next.c1x = docPt.x;
              next.c1y = docPt.y;
            } else if (selection.handle === "c2") {
              next.c2x = docPt.x;
              next.c2y = docPt.y;
            }
            return next;
          }),
        };
      }),
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
    ctx.clearRect(0, 0, stageW, stageH);

    for (const layer of allLayers) {
      if (!layer.visible) continue;
      for (const item of layer.items) {
        const displayItem = toDisplayItem(item);
        const isSelectedDetector =
          item.type === "detector" &&
          selectedDraftDetector?.layerId === layer.id &&
          selectedDraftDetector?.itemId === item.id;
        const isSelectedItem = selectedDraftItem?.layerId === layer.id && selectedDraftItem?.itemId === item.id;
        drawItem(ctx, displayItem, layer.color, Boolean(isSelectedDetector));
        if (isSelectedItem && item.type === "rect" && displayItem.type === "rect") {
          ctx.save();
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = 2;
          ctx.strokeRect(displayItem.x - 3, displayItem.y - 3, displayItem.w + 6, displayItem.h + 6);
          ctx.restore();
        }
        if (isSelectedItem && item.type === "text" && displayItem.type === "text") {
          const width = Math.max(40, displayItem.text.length * 8);
          const height = 18;
          ctx.save();
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = 2;
          ctx.strokeRect(displayItem.x - 4, displayItem.y - height, width + 8, height + 6);
          ctx.restore();
        }
      }
    }

    if (draft && activeLayer) {
      drawItem(ctx, toDisplayItem(draft as OverlayItem), activeLayer.color, false);
    }

    const selectedLine = getSelectedLineWithPoints();
    if (selectedLine) {
      const p = selectedLine.points;
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.c1x, p.c1y);
      ctx.moveTo(p.x2, p.y2);
      ctx.lineTo(p.c2x, p.c2y);
      ctx.stroke();
      ctx.setLineDash([]);

      const handles: Array<{ x: number; y: number; active?: boolean }> = [
        { x: p.x1, y: p.y1, active: dragLineHandle?.handle === "start" },
        { x: p.c1x, y: p.c1y, active: dragLineHandle?.handle === "c1" },
        { x: p.c2x, y: p.c2y, active: dragLineHandle?.handle === "c2" },
        { x: p.x2, y: p.y2, active: dragLineHandle?.handle === "end" },
      ];
      for (const handle of handles) {
        ctx.beginPath();
        ctx.fillStyle = handle.active ? "#0ea5e9" : "#ffffff";
        ctx.strokeStyle = "#0369a1";
        ctx.lineWidth = 2;
        ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [allLayers, draft, activeLayer, selectedDraftDetector, selectedDraftItem, selectedDraftLine, dragLineHandle, stageW, stageH, docOffset.x, docOffset.y]);

  useEffect(() => {
    if (!selectedDraftLine) return;
    const layer = draftLayers.find((l) => l.id === selectedDraftLine.layerId);
    const line = layer?.items.find((item) => item.id === selectedDraftLine.itemId && item.type === "line");
    if (!line) {
      setSelectedDraftLine(null);
      setDragLineHandle(null);
    }
  }, [draftLayers, selectedDraftLine]);

  useEffect(() => {
    if (!selectedDraftItem) return;
    const layer = draftLayers.find((l) => l.id === selectedDraftItem.layerId);
    const exists = layer?.items.some((item) => item.id === selectedDraftItem.itemId);
    if (!exists) {
      setSelectedDraftItem(null);
      setSelectedDraftLine(null);
      onSelectDraftDetector(null);
    }
  }, [draftLayers, selectedDraftItem, onSelectDraftDetector]);

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch") return;
    if (!activeLayer) return;
    const pt = pointerToStage(e);
    const docPt = toDocPoint(pt);
    const hitHandle = findLineHandleAt(pt.x, pt.y);
    if (hitHandle) {
      setDragLineHandle(hitHandle);
      setSelectedDraftItem({ layerId: hitHandle.layerId, itemId: hitHandle.itemId });
      onSelectDraftDetector(null);
      return;
    }

    const hitItem = findDraftItemAt(pt.x, pt.y);
    if (hitItem) {
      selectItem(hitItem);
      if (activeTool === "select" || activeTool === "line") return;
      const hitLayer = draftLayers.find((l) => l.id === hitItem.layerId);
      const hitValue = hitLayer?.items.find((item) => item.id === hitItem.itemId);
      if (activeTool === "detector" && hitValue?.type === "detector") return;
    }

    if (activeTool === "select") {
      if (!hitItem) {
        selectItem(null);
      }
      setIsPanning(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!hitItem) selectItem(null);

    if (activeTool === "detector") {
      const nextDetector: OverlayItem = {
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
      };
      addToActive(nextDetector);
      selectItem({ layerId: activeLayer.id, itemId: nextDetector.id });
      return;
    }
    if (activeTool === "text") {
      const nextText: OverlayItem = { id: crypto.randomUUID(), type: "text", x: docPt.x, y: docPt.y, text: "Tekst" };
      addToActive(nextText);
      selectItem({ layerId: activeLayer.id, itemId: nextText.id });
      return;
    }
    if (activeTool === "erase") {
      if (hitItem) {
        selectItem(hitItem);
        deleteSelectedItem();
      } else {
        eraseLast();
      }
      return;
    }
    if (activeTool === "line" || activeTool === "rect") {
      dragStartRef.current = docPt;
      if (activeTool === "line") {
        setDraft({
          type: "line",
          x1: docPt.x,
          y1: docPt.y,
          x2: docPt.x,
          y2: docPt.y,
          c1x: docPt.x,
          c1y: docPt.y,
          c2x: docPt.x,
          c2y: docPt.y,
        });
      } else {
        setDraft({ type: "rect", x: docPt.x, y: docPt.y, w: 0, h: 0 });
      }
    }
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch") return;
    if (dragLineHandle) {
      const docPt = toDocPoint(pointerToStage(e));
      updateLineHandle(dragLineHandle, docPt);
      return;
    }

    const dragStart = dragStartRef.current;
    if (isPanning && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanOffset((prev) => clampPan({ x: prev.x + dx, y: prev.y + dy }, zoom));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!dragStart) return;
    const docPt = toDocPoint(pointerToStage(e));
    if (activeTool === "line") {
      const c1x = dragStart.x + (docPt.x - dragStart.x) * 0.33;
      const c1y = dragStart.y + (docPt.y - dragStart.y) * 0.33;
      const c2x = dragStart.x + (docPt.x - dragStart.x) * 0.67;
      const c2y = dragStart.y + (docPt.y - dragStart.y) * 0.67;
      setDraft({ type: "line", x1: dragStart.x, y1: dragStart.y, x2: docPt.x, y2: docPt.y, c1x, c1y, c2x, c2y });
      return;
    }
    if (activeTool === "rect") {
      const rect = normalizeRect(dragStart.x, dragStart.y, docPt.x, docPt.y);
      setDraft({ type: "rect", ...rect });
    }
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "touch") return;
    if (dragLineHandle) {
      setDragLineHandle(null);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      dragStartRef.current = null;
      return;
    }

    const dragStart = dragStartRef.current;
    if (!activeLayer) return;
    if (!dragStart) return;
    const docPt = toDocPoint(pointerToStage(e));
    if (activeTool === "line") {
      const c1x = dragStart.x + (docPt.x - dragStart.x) * 0.33;
      const c1y = dragStart.y + (docPt.y - dragStart.y) * 0.33;
      const c2x = dragStart.x + (docPt.x - dragStart.x) * 0.67;
      const c2y = dragStart.y + (docPt.y - dragStart.y) * 0.67;
      const nextLine: OverlayItem = {
        id: crypto.randomUUID(),
        type: "line",
        x1: dragStart.x,
        y1: dragStart.y,
        x2: docPt.x,
        y2: docPt.y,
        c1x,
        c1y,
        c2x,
        c2y,
      };
      addToActive(nextLine);
      selectItem({ layerId: activeLayer.id, itemId: nextLine.id });
    } else if (activeTool === "rect") {
      const rect = normalizeRect(dragStart.x, dragStart.y, docPt.x, docPt.y);
      const nextRect: OverlayItem = { id: crypto.randomUUID(), type: "rect", ...rect };
      addToActive(nextRect);
      selectItem({ layerId: activeLayer.id, itemId: nextRect.id });
    }
    dragStartRef.current = null;
    setDraft(null);
  }

  function onTouchStart(e: TouchEvent<HTMLCanvasElement>) {
    if (!viewportRef.current) return;
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
      touchTapStartRef.current = null;
      touchPanStartRef.current = null;
      dragStartRef.current = null;
      setDraft(null);
    } else if (e.touches.length === 1) {
      e.preventDefault();
      const t = e.touches[0];
      const stagePt = touchToStage(t);
      if (!stagePt || !activeLayer) return;
      const docPt = toDocPoint(stagePt);
      touchTapStartRef.current = { x: t.clientX, y: t.clientY };

      const hitHandle = findLineHandleAt(stagePt.x, stagePt.y);
      if (hitHandle) {
        setDragLineHandle(hitHandle);
        setSelectedDraftItem({ layerId: hitHandle.layerId, itemId: hitHandle.itemId });
        onSelectDraftDetector(null);
        dragStartRef.current = null;
        setDraft(null);
        touchPanStartRef.current = null;
        return;
      }

      const hitItem = findDraftItemAt(stagePt.x, stagePt.y);
      if (hitItem) {
        selectItem(hitItem);
        const hitLayer = draftLayers.find((l) => l.id === hitItem.layerId);
        const hitValue = hitLayer?.items.find((item) => item.id === hitItem.itemId);
        if (activeTool === "line" || activeTool === "select") {
          dragStartRef.current = null;
          setDraft(null);
          touchPanStartRef.current = activeTool === "select" ? { x: t.clientX, y: t.clientY } : null;
          return;
        }
        if (activeTool === "detector" && hitValue?.type === "detector") {
          dragStartRef.current = null;
          setDraft(null);
          touchPanStartRef.current = null;
          return;
        }
      } else {
        selectItem(null);
      }

      if (activeTool === "select") {
        touchPanStartRef.current = { x: t.clientX, y: t.clientY };
      } else {
        touchPanStartRef.current = null;
      }

      if (activeTool === "line") {
        dragStartRef.current = docPt;
        setDraft({
          type: "line",
          x1: docPt.x,
          y1: docPt.y,
          x2: docPt.x,
          y2: docPt.y,
          c1x: docPt.x,
          c1y: docPt.y,
          c2x: docPt.x,
          c2y: docPt.y,
        });
      } else if (activeTool === "rect") {
        dragStartRef.current = docPt;
        setDraft({ type: "rect", x: docPt.x, y: docPt.y, w: 0, h: 0 });
      } else {
        dragStartRef.current = null;
        setDraft(null);
      }
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
      const newZoom = touchStart.zoom * scale;
      const cx = (t0.clientX + t1.clientX) / 2;
      const cy = (t0.clientY + t1.clientY) / 2;
      applyZoomAt(newZoom, cx, cy);
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const stagePt = touchToStage(t);
      if (!stagePt) return;
      const docPt = toDocPoint(stagePt);
      const dragStart = dragStartRef.current;

      if (dragLineHandle) {
        e.preventDefault();
        updateLineHandle(dragLineHandle, docPt);
      } else if (activeTool === "line" && dragStart) {
        e.preventDefault();
        const c1x = dragStart.x + (docPt.x - dragStart.x) * 0.33;
        const c1y = dragStart.y + (docPt.y - dragStart.y) * 0.33;
        const c2x = dragStart.x + (docPt.x - dragStart.x) * 0.67;
        const c2y = dragStart.y + (docPt.y - dragStart.y) * 0.67;
        setDraft({ type: "line", x1: dragStart.x, y1: dragStart.y, x2: docPt.x, y2: docPt.y, c1x, c1y, c2x, c2y });
      } else if (activeTool === "rect" && dragStart) {
        e.preventDefault();
        const rect = normalizeRect(dragStart.x, dragStart.y, docPt.x, docPt.y);
        setDraft({ type: "rect", ...rect });
      } else if (touchPanStartRef.current) {
        e.preventDefault();
        const start = touchPanStartRef.current;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        const moved = Math.hypot(dx, dy) > 8;
        if (moved) {
          setPanOffset((prev) => clampPan({ x: prev.x + dx, y: prev.y + dy }, zoom));
          touchPanStartRef.current = { x: t.clientX, y: t.clientY };
        }
      }
    }
  }

  function onTouchEnd(e: TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length < 2) {
      setTouchStart(null);
    }
    if (e.touches.length === 0) {
      if (dragLineHandle) {
        setDragLineHandle(null);
        return;
      }
      const startPoint = dragStartRef.current;
      dragStartRef.current = null;
      setIsPanning(false);
      const tapStart = touchTapStartRef.current;
      touchPanStartRef.current = null;
      touchTapStartRef.current = null;
      if (!tapStart) return;
      const changed = e.changedTouches[0];
      if (!changed) return;
      const movedDistance = Math.hypot(changed.clientX - tapStart.x, changed.clientY - tapStart.y);
      const stagePt = touchToStage(changed);
      if (!stagePt || !activeLayer) return;
      const docPt = toDocPoint(stagePt);

      if (activeTool === "line" && startPoint) {
        const c1x = startPoint.x + (docPt.x - startPoint.x) * 0.33;
        const c1y = startPoint.y + (docPt.y - startPoint.y) * 0.33;
        const c2x = startPoint.x + (docPt.x - startPoint.x) * 0.67;
        const c2y = startPoint.y + (docPt.y - startPoint.y) * 0.67;
        const nextLine: OverlayItem = {
          id: crypto.randomUUID(),
          type: "line",
          x1: startPoint.x,
          y1: startPoint.y,
          x2: docPt.x,
          y2: docPt.y,
          c1x,
          c1y,
          c2x,
          c2y,
        };
        addToActive(nextLine);
        selectItem({ layerId: activeLayer.id, itemId: nextLine.id });
        setDraft(null);
        return;
      }

      if (activeTool === "rect" && startPoint) {
        const rect = normalizeRect(startPoint.x, startPoint.y, docPt.x, docPt.y);
        const nextRect: OverlayItem = { id: crypto.randomUUID(), type: "rect", ...rect };
        addToActive(nextRect);
        selectItem({ layerId: activeLayer.id, itemId: nextRect.id });
        setDraft(null);
        return;
      }

      if (movedDistance > 7) return;

      const hitItem = findDraftItemAt(stagePt.x, stagePt.y);
      if (hitItem) {
        selectItem(hitItem);
        const hitLayer = draftLayers.find((l) => l.id === hitItem.layerId);
        const hitValue = hitLayer?.items.find((item) => item.id === hitItem.itemId);
        if (activeTool === "detector" && hitValue?.type === "detector") return;
      } else {
        selectItem(null);
      }

      if (activeTool === "detector") {
        const nextDetector: OverlayItem = {
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
        };
        addToActive(nextDetector);
        selectItem({ layerId: activeLayer.id, itemId: nextDetector.id });
      } else if (activeTool === "text") {
        const nextText: OverlayItem = { id: crypto.randomUUID(), type: "text", x: docPt.x, y: docPt.y, text: "Tekst" };
        addToActive(nextText);
        selectItem({ layerId: activeLayer.id, itemId: nextText.id });
      } else if (activeTool === "erase") {
        if (hitItem) {
          selectItem(hitItem);
          deleteSelectedItem();
        } else {
          eraseLast();
        }
      }
    }
  }

  function clampPan(nextPan: { x: number; y: number }, nextZoom: number) {
    const view = viewportRef.current;
    if (!view) return nextPan;
    const vw = view.clientWidth;
    const vh = view.clientHeight;
    const contentW = stageW * nextZoom;
    const contentH = stageH * nextZoom;
    const maxX = Math.max(0, (contentW - vw) / 2);
    const maxY = Math.max(0, (contentH - vh) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextPan.x)),
      y: Math.max(-maxY, Math.min(maxY, nextPan.y)),
    };
  }

  function minAllowedZoom() {
    return Math.max(MIN_ZOOM, fitZoom);
  }

  function clampZoomForViewport(value: number) {
    const minZoom = minAllowedZoom();
    return Math.max(minZoom, Math.min(MAX_ZOOM, Number(value.toFixed(3))));
  }

  function applyZoomAt(nextZoomUnclamped: number, clientX: number, clientY: number) {
    const view = viewportRef.current;
    if (!view) return;
    const nextZoom = clampZoomForViewport(nextZoomUnclamped);
    const rect = view.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    const originX = rect.width / 2 - (stageW * zoom) / 2 + panOffset.x;
    const originY = rect.height / 2 - (stageH * zoom) / 2 + panOffset.y;
    const stageX = (relX - originX) / zoom;
    const stageY = (relY - originY) / zoom;

    const nextOriginX = rect.width / 2 - (stageW * nextZoom) / 2;
    const nextOriginY = rect.height / 2 - (stageH * nextZoom) / 2;
    const nextPan = {
      x: relX - stageX * nextZoom - nextOriginX,
      y: relY - stageY * nextZoom - nextOriginY,
    };

    setZoomMode("manual");
    setManualZoom(nextZoom);
    setPanOffset(clampPan(nextPan, nextZoom));
  }

  function increaseZoom() {
    const view = viewportRef.current;
    if (!view) return;
    const rect = view.getBoundingClientRect();
    applyZoomAt(zoom + ZOOM_STEP, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function decreaseZoom() {
    const view = viewportRef.current;
    if (!view) return;
    const rect = view.getBoundingClientRect();
    applyZoomAt(zoom - ZOOM_STEP, rect.left + rect.width / 2, rect.top + rect.height / 2);
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

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0018;
    if (delta === 0) return;
    applyZoomAt(zoom + delta, e.clientX, e.clientY);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key !== "Delete" && e.key !== "Backspace") || !selectedDraftItem) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      deleteSelectedItem();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedDraftItem]);

  return (
    <section className="relative h-full min-h-0 min-w-0 flex-1 bg-zinc-950 text-zinc-100">
      {/* ── Top bar ── */}
      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 sm:inset-x-3 sm:top-2.5">
        <div className="pointer-events-auto flex max-w-full items-center gap-0 rounded-xl border border-zinc-800/80 bg-zinc-950/96 shadow-xl backdrop-blur-md">

          {/* Drawing name */}
          <div className="flex min-w-0 items-center pl-3 pr-2">
            <p className="max-w-[8rem] truncate text-[11px] font-semibold text-zinc-300 sm:max-w-[16rem] sm:text-xs">
              {drawingName}
            </p>
          </div>

          {/* Separator */}
          <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-800" />

          {/* Zoom group */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={decreaseZoom}
              title="Zoom ut (scroll ned)"
              className="flex h-9 w-8 items-center justify-center rounded-l-lg text-sm font-bold text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 active:scale-95"
            >
              −
            </button>
            <button
              type="button"
              onClick={fitToViewport}
              title="Tilpass til vindu"
              className={`flex h-9 min-w-[3.5rem] items-center justify-center text-[11px] font-bold tabular-nums transition-all sm:text-xs ${
                zoomMode === "fit"
                  ? "bg-cyan-500/10 text-cyan-300"
                  : "text-zinc-300 hover:bg-zinc-800/50 hover:text-zinc-100"
              }`}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={increaseZoom}
              title="Zoom inn (scroll opp)"
              className="flex h-9 w-8 items-center justify-center rounded-r-lg text-sm font-bold text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 active:scale-95"
            >
              +
            </button>
          </div>

          {/* Separator */}
          <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-800" />

          {/* Fit + Reset */}
          <div className="flex items-center gap-0.5 px-1">
            <button
              type="button"
              onClick={fitToViewport}
              title="Tilpass til vindu"
              className={`flex h-9 items-center rounded-lg px-2.5 text-[11px] font-bold transition-all sm:text-xs ${
                zoomMode === "fit"
                  ? "text-cyan-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Tilbakestill zoom (1.5×)"
              className="flex h-9 items-center rounded-lg px-2 text-[11px] font-bold text-zinc-600 transition-colors hover:text-zinc-300 sm:text-xs"
            >
              ⌖
            </button>
          </div>

          {/* Delete (when item selected) */}
          {selectedDraftItem && (
            <>
              <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-800" />
              <button
                type="button"
                onClick={deleteSelectedItem}
                title="Slett valgt element (Delete)"
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 sm:text-xs"
              >
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h4M2 4h12m-1.5 0-.75 9.5A1.5 1.5 0 0110.25 15h-4.5A1.5 1.5 0 014.25 13.5L3.5 4" />
                </svg>
                <span className="hidden sm:inline">Slett</span>
              </button>
            </>
          )}

          {/* Panel toggle – desktop only */}
          {onTogglePanel && (
            <>
              <div className="mx-0.5 hidden h-5 w-px shrink-0 bg-zinc-800 sm:block" />
              <button
                type="button"
                onClick={onTogglePanel}
                title={panelOpen ? "Skjul panel" : "Vis panel"}
                className={`hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition-all sm:flex sm:text-xs ${
                  panelOpen
                    ? "text-cyan-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 2h12a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1zm7 0v12" />
                </svg>
                {panelOpen ? "Skjul" : "Panel"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Canvas viewport ── */}
      <div
        ref={viewportRef}
        onWheel={onWheel}
        className="relative h-full w-full touch-none overflow-hidden bg-zinc-950"
      >
        <div
          className="absolute left-1/2 top-1/2 overflow-hidden rounded-sm border border-zinc-700/80 bg-white shadow-2xl"
          style={{
            width: `${Math.round(stageW * zoom)}px`,
            height: `${Math.round(stageH * zoom)}px`,
            transform: `translate(-50%, -50%) translate(${panOffset.x}px, ${panOffset.y}px)`,
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
            className={`absolute inset-0 z-10 h-full w-full touch-none ${canvasCursor}`}
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

      {/* ── Active tool indicator – bottom-left corner ── */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 sm:bottom-3 sm:left-3">
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/80 px-2.5 py-1 backdrop-blur-sm">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            {activeTool}
          </span>
        </div>
      </div>
    </section>
  );
}

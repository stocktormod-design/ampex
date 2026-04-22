"use client";

import { useState } from "react";
import { PaintCanvas } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-canvas";
import { PaintToolbar } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-toolbar";
import type { OverlayLayer, ToolId } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type Props = {
  fileUrl: string;
  filePath: string;
  drawingName: string;
};

const LAYER_COLORS = ["#ef4444", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2"];

function newLayer(index: number): OverlayLayer {
  return {
    id: crypto.randomUUID(),
    name: `Lag ${index}`,
    visible: true,
    color: LAYER_COLORS[(index - 1) % LAYER_COLORS.length],
    items: [],
  };
}

export function PaintWorkbench({ fileUrl, filePath, drawingName }: Props) {
  const [activeTool, setActiveTool] = useState<ToolId>("detector");
  const [layers, setLayers] = useState<OverlayLayer[]>([newLayer(1)]);
  const [activeLayerId, setActiveLayerId] = useState<string>(() => layers?.[0]?.id ?? "");

  function addLayer() {
    setLayers((prev) => {
      const layer = newLayer(prev.length + 1);
      setActiveLayerId(layer.id);
      return [...prev, layer];
    });
  }

  function toggleLayer(layerId: string) {
    setLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)));
  }

  function clearActiveLayer() {
    setLayers((prev) => prev.map((l) => (l.id === activeLayerId ? { ...l, items: [] } : l)));
  }

  return (
    <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-lg border bg-background lg:flex-row">
      <PaintCanvas
        fileUrl={fileUrl}
        filePath={filePath}
        drawingName={drawingName}
        activeTool={activeTool}
        layers={layers}
        activeLayerId={activeLayerId}
        onUpdateLayers={setLayers}
      />
      <PaintToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        layers={layers}
        activeLayerId={activeLayerId}
        onSetActiveLayer={setActiveLayerId}
        onAddLayer={addLayer}
        onToggleLayer={toggleLayer}
        onClearActiveLayer={clearActiveLayer}
      />
    </div>
  );
}

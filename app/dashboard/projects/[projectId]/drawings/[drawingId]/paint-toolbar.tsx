"use client";

import { useMemo } from "react";
import type { OverlayLayer, ToolId } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type ToolDef = {
  id: ToolId;
  label: string;
  hint: string;
};

const TOOLS: ToolDef[] = [
  { id: "select", label: "Velg", hint: "Velg elementer i overlay" },
  { id: "detector", label: "Detektor", hint: "Plasser branndetektor-punkt" },
  { id: "line", label: "Linje", hint: "Tegn rette linjer" },
  { id: "rect", label: "Rektangel", hint: "Lag markeringsboks" },
  { id: "text", label: "Tekst", hint: "Legg inn tekst-annotasjon" },
  { id: "erase", label: "Slett", hint: "Fjern markeringer" },
];

type Props = {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  layers: OverlayLayer[];
  activeLayerId: string;
  onSetActiveLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onToggleLayer: (layerId: string) => void;
  onClearActiveLayer: () => void;
};

export function PaintToolbar({
  activeTool,
  onSelectTool,
  layers,
  activeLayerId,
  onSetActiveLayer,
  onAddLayer,
  onToggleLayer,
  onClearActiveLayer,
}: Props) {
  const current = useMemo(() => TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0], [activeTool]);

  return (
    <aside className="w-full max-w-xs shrink-0 border-l bg-card">
      <div className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold">Verktøy</h2>
          <p className="text-xs text-muted-foreground">UI-first. Tegning/lagring kobles i neste fase.</p>
        </div>

        <div className="grid gap-2">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                activeTool === tool.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              <span className="font-medium">{tool.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{tool.hint}</span>
            </button>
          ))}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium">Aktivt verktøy</p>
          <p className="mt-1 text-sm">{current.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{current.hint}</p>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Lag</p>
            <button
              type="button"
              onClick={onAddLayer}
              className="rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-muted"
            >
              + Nytt lag
            </button>
          </div>
          <ul className="space-y-1.5">
            {layers.map((layer) => (
              <li key={layer.id} className="rounded border border-border bg-background px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSetActiveLayer(layer.id)}
                    className={`min-w-0 flex-1 truncate text-left text-xs ${
                      activeLayerId === layer.id ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: layer.color }}
                    />
                    {layer.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleLayer(layer.id)}
                    className="rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-muted"
                  >
                    {layer.visible ? "Skjul" : "Vis"}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{layer.items.length} elementer</p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onClearActiveLayer}
            className="w-full rounded border border-destructive/40 bg-background px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
          >
            Tøm aktivt lag
          </button>
        </div>
      </div>
    </aside>
  );
}

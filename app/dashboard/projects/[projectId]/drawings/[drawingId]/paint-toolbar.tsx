"use client";

import { useMemo } from "react";
import { MousePointer2, Flame, Slash, RectangleHorizontal, Type, Eraser, Layers3, Eye, EyeOff, Plus } from "lucide-react";
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

const ICONS: Record<ToolId, typeof MousePointer2> = {
  select: MousePointer2,
  detector: Flame,
  line: Slash,
  rect: RectangleHorizontal,
  text: Type,
  erase: Eraser,
};

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
    <aside className="w-full max-w-[4.25rem] shrink-0 rounded-lg border bg-card/95 shadow-sm backdrop-blur">
      <div className="space-y-2 p-2">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tools</h2>
        </div>

        <div className="grid gap-1">
          {TOOLS.map((tool) => (
            (() => {
              const Icon = ICONS[tool.id];
              return (
                <button
                  key={tool.id}
                  type="button"
                  title={`${tool.label} — ${tool.hint}`}
                  onClick={() => onSelectTool(tool.id)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                    activeTool === tool.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              );
            })()
          ))}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-2">
          <p className="text-[10px] font-medium">Aktiv</p>
          <p className="mt-0.5 truncate text-[10px]">{current.label}</p>
        </div>

        <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
          <div className="flex items-center justify-center">
            <Layers3 className="size-3.5 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-1">
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                title={`${layer.name} (${layer.items.length})`}
                onClick={() => onSetActiveLayer(layer.id)}
                className={`relative flex h-7 w-9 items-center justify-center rounded border ${
                  activeLayerId === layer.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layer.color }} />
                <span className="absolute -right-1 -top-1 rounded bg-muted px-1 text-[9px] text-muted-foreground">
                  {layer.items.length}
                </span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 pt-1">
            <button
              type="button"
              onClick={onAddLayer}
              title="Nytt lag"
              className="flex h-7 items-center justify-center rounded border border-input bg-background hover:bg-muted"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              title="Vis/skjul aktivt lag"
              onClick={() => {
                if (!activeLayerId) return;
                onToggleLayer(activeLayerId);
              }}
              className="flex h-7 items-center justify-center rounded border border-input bg-background hover:bg-muted"
            >
              {(layers.find((l) => l.id === activeLayerId)?.visible ?? true) ? (
                <Eye className="size-3.5" aria-hidden />
              ) : (
                <EyeOff className="size-3.5" aria-hidden />
              )}
            </button>
          </div>
          <button
            type="button"
            title="Tøm aktivt lag"
            onClick={onClearActiveLayer}
            className="w-full rounded border border-destructive/40 bg-background px-1 py-1 text-[10px] text-destructive hover:bg-destructive/10"
          >
            Tøm
          </button>
        </div>
      </div>
    </aside>
  );
}

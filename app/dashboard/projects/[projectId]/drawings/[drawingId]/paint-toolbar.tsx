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
  mobile?: boolean;
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
  mobile = false,
}: Props) {
  const current = useMemo(() => TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0], [activeTool]);
  if (mobile) {
    return (
      <aside className="rounded-lg border bg-card px-2 py-2 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {TOOLS.map((tool) => {
            const Icon = ICONS[tool.id];
            return (
              <button
                key={tool.id}
                type="button"
                title={`${tool.label} — ${tool.hint}`}
                onClick={() => onSelectTool(tool.id)}
                className={`flex h-9 min-w-9 items-center justify-center rounded-md border transition-colors ${
                  activeTool === tool.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
          <button
            type="button"
            onClick={onAddLayer}
            title="Nytt lag"
            className="flex h-9 min-w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            title="Vis/skjul aktivt lag"
            onClick={() => {
              if (!activeLayerId) return;
              onToggleLayer(activeLayerId);
            }}
            className="flex h-9 min-w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-muted"
          >
            {(layers.find((l) => l.id === activeLayerId)?.visible ?? true) ? (
              <Eye className="size-4" aria-hidden />
            ) : (
              <EyeOff className="size-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            title="Tøm aktivt lag"
            onClick={onClearActiveLayer}
            className="rounded-md border border-destructive/40 bg-background px-2 py-2 text-xs text-destructive hover:bg-destructive/10"
          >
            Tøm
          </button>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          Aktivt verktøy: {current.label} · Lag: {layers.find((l) => l.id === activeLayerId)?.name ?? "—"}
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-full max-w-[4.25rem] shrink-0 rounded-xl border border-zinc-700/70 bg-zinc-900/95 text-zinc-100 shadow-xl backdrop-blur">
      <div className="space-y-2 p-2">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Tools</h2>
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
                      ? "border-blue-400/80 bg-blue-500/20 text-blue-100"
                      : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              );
            })()
          ))}
        </div>

        <div className="rounded-md border border-zinc-700 bg-zinc-800/70 p-2">
          <p className="text-[10px] font-medium text-zinc-300">Aktiv</p>
          <p className="mt-0.5 truncate text-[10px]">{current.label}</p>
        </div>

        <div className="space-y-1 rounded-md border border-zinc-700 bg-zinc-800/70 p-2">
          <div className="flex items-center justify-center">
            <Layers3 className="size-3.5 text-zinc-400" aria-hidden />
          </div>
          <div className="space-y-1">
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                title={`${layer.name} (${layer.items.length})`}
                onClick={() => onSetActiveLayer(layer.id)}
                className={`relative flex h-7 w-9 items-center justify-center rounded border ${
                  activeLayerId === layer.id
                    ? "border-blue-400/80 bg-blue-500/20"
                    : "border-zinc-700 bg-zinc-900 hover:bg-zinc-700"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layer.color }} />
                <span className="absolute -right-1 -top-1 rounded bg-zinc-700 px-1 text-[9px] text-zinc-300">
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
              className="flex h-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-700"
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
              className="flex h-7 items-center justify-center rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-700"
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
            className="w-full rounded border border-red-500/50 bg-zinc-900 px-1 py-1 text-[10px] text-red-300 hover:bg-red-500/10"
          >
            Tøm
          </button>
        </div>
      </div>
    </aside>
  );
}

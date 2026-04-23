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
  activeLayer?: OverlayLayer | null;
  onSetActiveLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onToggleLayer: (layerId: string) => void;
  onClearActiveLayer: () => void;
  mobile?: boolean;
  bottomBar?: boolean;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
};

export function PaintToolbar({
  activeTool,
  onSelectTool,
  layers,
  activeLayerId,
  activeLayer,
  onSetActiveLayer,
  onAddLayer,
  onToggleLayer,
  onClearActiveLayer,
  mobile = false,
  bottomBar = false,
  panelOpen,
  onTogglePanel,
}: Props) {
  const current = useMemo(() => TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0], [activeTool]);
  const isLayerVisible = layers.find((l) => l.id === activeLayerId)?.visible ?? true;

  if (bottomBar) {
    return (
      <nav className="flex w-full items-center gap-0.5 overflow-x-auto px-2 py-2">
        {TOOLS.map((tool) => {
          const Icon = ICONS[tool.id];
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={`${tool.label} — ${tool.hint}`}
              onClick={() => onSelectTool(tool.id)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                isActive
                  ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                  : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <Icon className="size-[18px]" aria-hidden />
            </button>
          );
        })}

        <div className="mx-1.5 h-6 w-px shrink-0 bg-zinc-800" />

        <button
          type="button"
          onClick={onAddLayer}
          title="Nytt lag"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 transition-all hover:border-zinc-700 hover:text-zinc-300 active:scale-95"
        >
          <Plus className="size-[18px]" aria-hidden />
        </button>

        <button
          type="button"
          title="Vis/skjul aktivt lag"
          onClick={() => { if (activeLayerId) onToggleLayer(activeLayerId); }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 transition-all hover:border-zinc-700 hover:text-zinc-300 active:scale-95"
        >
          {isLayerVisible
            ? <Eye className="size-[18px]" aria-hidden />
            : <EyeOff className="size-[18px]" aria-hidden />}
        </button>

        <button
          type="button"
          title="Tøm aktivt lag"
          onClick={onClearActiveLayer}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-zinc-900 text-red-500/70 transition-all hover:border-red-500/50 hover:text-red-400 active:scale-95"
        >
          <Eraser className="size-[18px]" aria-hidden />
        </button>

        {onTogglePanel && (
          <>
            <div className="mx-1.5 h-6 w-px shrink-0 bg-zinc-800" />
            <button
              type="button"
              onClick={onTogglePanel}
              title={panelOpen ? "Skjul panel" : "Vis panel"}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                panelOpen
                  ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                  : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <Layers3 className="size-[18px]" aria-hidden />
              {activeLayer && (
                <span
                  className="absolute right-1 top-1 h-2 w-2 rounded-full ring-1 ring-zinc-950"
                  style={{ backgroundColor: activeLayer.color }}
                />
              )}
            </button>
          </>
        )}
      </nav>
    );
  }

  if (mobile) {
    return (
      <aside className="w-[3.25rem] rounded-xl border border-zinc-800 bg-zinc-950/95 text-zinc-100 shadow-xl backdrop-blur">
        <div className="space-y-1 p-1.5">
          {TOOLS.map((tool) => {
            const Icon = ICONS[tool.id];
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                title={`${tool.label} — ${tool.hint}`}
                onClick={() => onSelectTool(tool.id)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                  isActive
                    ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
          <div className="my-1 h-px bg-zinc-800" />
          <button
            type="button"
            onClick={onAddLayer}
            title="Nytt lag"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
          >
            <Plus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            title="Vis/skjul aktivt lag"
            onClick={() => { if (activeLayerId) onToggleLayer(activeLayerId); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
          >
            {isLayerVisible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
          </button>
          <button
            type="button"
            title="Tøm aktivt lag"
            onClick={onClearActiveLayer}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-zinc-900 text-red-500/70 hover:border-red-500/50 hover:text-red-400"
          >
            <Eraser className="size-4" aria-hidden />
          </button>
        </div>
      </aside>
    );
  }

  /* ── Desktop vertical toolbar ── */
  return (
    <aside className="w-[4.25rem] shrink-0 rounded-xl border border-zinc-800 bg-zinc-950/95 text-zinc-100 shadow-xl backdrop-blur">
      <div className="space-y-2 p-2">
        <p className="text-center text-[9px] font-bold uppercase tracking-widest text-zinc-700">Tools</p>

        <div className="grid gap-1">
          {TOOLS.map((tool) => {
            const Icon = ICONS[tool.id];
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                title={`${tool.label} — ${tool.hint}`}
                onClick={() => onSelectTool(tool.id)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                  isActive
                    ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.12)]"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Aktiv</p>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-cyan-300">{current.label}</p>
        </div>

        <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900 p-1.5">
          <div className="flex items-center justify-center">
            <Layers3 className="size-3 text-zinc-600" aria-hidden />
          </div>
          <div className="space-y-1">
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                title={`${layer.name} (${layer.items.length})`}
                onClick={() => onSetActiveLayer(layer.id)}
                className={`relative flex h-7 w-9 items-center justify-center rounded-lg border transition-all ${
                  activeLayerId === layer.id
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layer.color }} />
                <span className="absolute -right-1 -top-1 rounded-full bg-zinc-800 px-1 text-[8px] font-bold text-zinc-400 ring-1 ring-zinc-950">
                  {layer.items.length}
                </span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 pt-0.5">
            <button
              type="button"
              onClick={onAddLayer}
              title="Nytt lag"
              className="flex h-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              title="Vis/skjul aktivt lag"
              onClick={() => { if (activeLayerId) onToggleLayer(activeLayerId); }}
              className="flex h-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            >
              {isLayerVisible ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
            </button>
          </div>
          <button
            type="button"
            title="Tøm aktivt lag"
            onClick={onClearActiveLayer}
            className="w-full rounded-lg border border-red-500/30 bg-zinc-900 py-1 text-[9px] font-bold uppercase tracking-wide text-red-500/70 hover:border-red-500/50 hover:text-red-400"
          >
            Tøm
          </button>
        </div>
      </div>
    </aside>
  );
}

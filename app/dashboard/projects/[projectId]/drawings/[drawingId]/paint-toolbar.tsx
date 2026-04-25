"use client";

import { useMemo } from "react";
import {
  MousePointer2,
  Flame,
  AlertTriangle,
  Slash,
  RectangleHorizontal,
  Type,
  Eraser,
  Layers3,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import type { OverlayLayer, ToolId } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type ToolDef = { id: ToolId; label: string; hint: string };

const TOOLS: ToolDef[] = [
  { id: "select",   label: "Velg",     hint: "Velg / panorer" },
  { id: "detector", label: "Detektor", hint: "Plasser branndetektor" },
  { id: "point",    label: "Punkt",    hint: "Plasser avvikspunkt" },
  { id: "line",     label: "Linje",    hint: "Tegn bezier-kurve" },
  { id: "rect",     label: "Rekt.",    hint: "Tegn rektangel" },
  { id: "text",     label: "Tekst",    hint: "Legg til tekst" },
  { id: "erase",    label: "Slett",    hint: "Slett element" },
];

const ICONS: Record<ToolId, typeof MousePointer2> = {
  select:   MousePointer2,
  detector: Flame,
  point:    AlertTriangle,
  line:     Slash,
  rect:     RectangleHorizontal,
  text:     Type,
  erase:    Eraser,
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
  sidebar?: boolean;
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
  sidebar = false,
  bottomBar = false,
  panelOpen,
  onTogglePanel,
}: Props) {
  const current = useMemo(() => TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0], [activeTool]);
  const isLayerVisible = layers.find((l) => l.id === activeLayerId)?.visible ?? true;

  /* ── LEFT SIDEBAR – desktop ── */
  if (sidebar) {
    return (
      <nav className="flex h-full flex-col bg-background" aria-label="Verktøylinje">
        {/* Tool buttons */}
        <div className="flex flex-1 flex-col gap-px overflow-y-auto px-1.5 py-2 min-h-0">
          <p className="mb-1.5 text-center text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
            Verktøy
          </p>

          {TOOLS.map((tool) => {
            const Icon = ICONS[tool.id];
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelectTool(tool.id)}
                title={`${tool.label} — ${tool.hint}`}
                className={`relative flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2.5 transition-all active:scale-95 ${
                  isActive
                    ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-cyan-400" />
                )}
                <Icon className="size-[15px] shrink-0" aria-hidden />
                <span
                  className={`text-[7.5px] font-bold uppercase leading-none tracking-wide ${
                    isActive ? "text-cyan-400" : ""
                  }`}
                >
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="mx-2 h-px shrink-0 bg-border" />

        {/* Layers */}
        <div className="flex shrink-0 flex-col gap-0.5 px-1.5 py-2">
          <p className="mb-1 text-center text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
            Lag
          </p>

          <div className="space-y-0.5">
            {layers.map((layer) => {
              const isActive = activeLayerId === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onSetActiveLayer(layer.id)}
                  title={`${layer.name} — ${layer.items.length} elementer`}
                  className={`relative flex h-8 w-full items-center justify-center rounded-lg transition-all active:scale-95 ${
                    isActive
                      ? "bg-muted ring-1 ring-inset ring-border"
                      : "hover:bg-muted/70"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-1 ring-white/10"
                    style={{ backgroundColor: layer.color }}
                  />
                  {layer.items.length > 0 && (
                    <span className="absolute right-0.5 top-0.5 min-w-[12px] text-center text-[7px] font-bold leading-none text-muted-foreground">
                      {layer.items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={onAddLayer}
              title="Nytt lag"
              className="flex h-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => { if (activeLayerId) onToggleLayer(activeLayerId); }}
              title={isLayerVisible ? "Skjul lag" : "Vis lag"}
              className="flex h-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
            >
              {isLayerVisible
                ? <Eye className="size-3.5" aria-hidden />
                : <EyeOff className="size-3.5" aria-hidden />}
            </button>
          </div>

          <button
            type="button"
            onClick={onClearActiveLayer}
            title="Tøm aktivt lag"
            className="mt-0.5 flex h-7 w-full items-center justify-center rounded-lg border border-destructive/30 bg-background text-destructive/70 transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </nav>
    );
  }

  /* ── BOTTOM BAR – mobile ── */
  if (bottomBar) {
    return (
      <nav
        className="flex w-full items-center gap-0.5 overflow-x-auto bg-background px-2 py-2"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Verktøylinje"
      >
        {TOOLS.map((tool) => {
          const Icon = ICONS[tool.id];
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              title={`${tool.label} — ${tool.hint}`}
              onClick={() => onSelectTool(tool.id)}
              className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border transition-all active:scale-95 ${
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className={`text-[7px] font-bold uppercase leading-none ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {tool.label.slice(0, 5)}
              </span>
            </button>
          );
        })}

        <div className="mx-1.5 h-6 w-px shrink-0 bg-border" />

        <button
          type="button"
          onClick={onAddLayer}
          title="Nytt lag"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
        >
          <Plus className="size-[18px]" aria-hidden />
        </button>

        <button
          type="button"
          title={isLayerVisible ? "Skjul lag" : "Vis lag"}
          onClick={() => { if (activeLayerId) onToggleLayer(activeLayerId); }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
        >
          {isLayerVisible
            ? <Eye className="size-[18px]" aria-hidden />
            : <EyeOff className="size-[18px]" aria-hidden />}
        </button>

        <button
          type="button"
          title="Tøm aktivt lag"
          onClick={onClearActiveLayer}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-destructive/30 bg-background text-destructive/70 transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
        >
          <Trash2 className="size-[18px]" aria-hidden />
        </button>

        {onTogglePanel && (
          <>
            <div className="mx-1.5 h-6 w-px shrink-0 bg-border" />
            <button
              type="button"
              onClick={onTogglePanel}
              title={panelOpen ? "Skjul panel" : "Vis panel"}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                panelOpen
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Layers3 className="size-[18px]" aria-hidden />
              {activeLayer && (
                <span
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-1 ring-zinc-950"
                  style={{ backgroundColor: activeLayer.color }}
                />
              )}
            </button>
          </>
        )}
      </nav>
    );
  }

  /* ── LEGACY DESKTOP FLOATING TOOLBAR (fallback) ── */
  return (
    <aside className="w-[4.25rem] shrink-0 rounded-xl border border-zinc-800 bg-zinc-950/95 text-zinc-100 shadow-xl backdrop-blur">
      <div className="space-y-2 p-2">
        <p className="text-center text-[9px] font-bold uppercase tracking-widest text-zinc-700">Verktøy</p>
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
              title={isLayerVisible ? "Skjul lag" : "Vis lag"}
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

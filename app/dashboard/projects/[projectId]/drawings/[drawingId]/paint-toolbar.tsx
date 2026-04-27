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

const SHORTCUT_KEYS: Record<ToolId, string> = {
  select: "1", detector: "2", point: "3", line: "4", rect: "5", text: "6", erase: "7",
};

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
  /** Når `sidebar`: hvilken skjermkant railen sitter på (aktiv-markør og hurtigtaster speiles). */
  railEdge?: "left" | "right";
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
  railEdge = "right",
  bottomBar = false,
  panelOpen,
  onTogglePanel,
}: Props) {
  const current = useMemo(() => TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0], [activeTool]);
  const isLayerVisible = layers.find((l) => l.id === activeLayerId)?.visible ?? true;

  /* ── DESKTOP VERTICAL RAIL (venstre eller høyre kant) ── */
  if (sidebar) {
    const edgeRight = railEdge === "right";
    const accentBar = edgeRight
      ? "absolute inset-y-2 right-0 w-0.5 rounded-l-full bg-cyan-400"
      : "absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-cyan-400";
    const keyBadge = edgeRight
      ? "absolute left-1 top-1 text-[9px] font-semibold tabular-nums leading-none text-zinc-500"
      : "absolute right-1 top-1 text-[9px] font-semibold tabular-nums leading-none text-zinc-500";

    return (
      <nav className="flex h-full w-full flex-col" aria-label="Verktøylinje">
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 py-3 min-h-0">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Verktøy
          </p>
          <div className="flex flex-col gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-1.5 shadow-inner">
            {TOOLS.map((tool) => {
              const Icon = ICONS[tool.id];
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onSelectTool(tool.id)}
                  title={`${tool.label} — ${tool.hint} [${SHORTCUT_KEYS[tool.id]}]`}
                  className={`relative flex w-full flex-col items-center gap-1 rounded-lg px-1.5 py-2.5 transition-colors duration-75 ease-out hover:bg-zinc-800/60 ${
                    isActive
                      ? "bg-cyan-500/[0.12] text-cyan-100 ring-1 ring-inset ring-cyan-500/25"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {isActive ? <span className={accentBar} aria-hidden /> : null}
                  <span className={keyBadge}>{SHORTCUT_KEYS[tool.id]}</span>
                  <Icon className="size-[18px] shrink-0 xl:size-5" aria-hidden />
                  <span
                    className={`max-w-full truncate text-center text-[9px] font-semibold uppercase leading-tight tracking-wide xl:text-[10px] ${
                      isActive ? "text-cyan-300" : "text-zinc-500"
                    }`}
                  >
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-2 h-px shrink-0 bg-zinc-800/90" />

        <div className="flex shrink-0 flex-col gap-1.5 px-2 py-3">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Lag
          </p>
          <div className="max-h-[40vh] space-y-1 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-1.5">
            {layers.map((layer) => {
              const isActive = activeLayerId === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onSetActiveLayer(layer.id)}
                  title={`${layer.name} — ${layer.items.length} elementer`}
                  className={`relative flex h-10 w-full items-center justify-center rounded-lg transition-colors duration-75 ease-out ${
                    isActive
                      ? "bg-zinc-800 ring-1 ring-inset ring-cyan-500/30"
                      : "hover:bg-zinc-800/50"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-zinc-950/80"
                    style={{ backgroundColor: layer.color }}
                  />
                  {layer.items.length > 0 ? (
                    <span className="absolute right-1 top-1 min-w-[1rem] rounded bg-zinc-950/90 px-0.5 text-center text-[9px] font-bold tabular-nums text-zinc-400">
                      {layer.items.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onAddLayer}
              title="Nytt lag"
              className="flex h-9 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/50 text-zinc-300 transition-colors duration-75 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-50"
            >
              <Plus className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeLayerId) onToggleLayer(activeLayerId);
              }}
              title={isLayerVisible ? "Skjul lag" : "Vis lag"}
              className="flex h-9 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/50 text-zinc-300 transition-colors duration-75 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-50"
            >
              {isLayerVisible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
            </button>
          </div>

          <button
            type="button"
            onClick={onClearActiveLayer}
            title="Tøm aktivt lag"
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/25 bg-zinc-900/50 text-[10px] font-semibold uppercase tracking-wide text-red-400/90 transition-colors duration-75 hover:border-red-500/45 hover:bg-red-950/30"
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden />
            Tøm
          </button>
        </div>
      </nav>
    );
  }

  /* ── BOTTOM BAR – mobile (korte transitions, touch-manipulation for raskere trykk) ── */
  if (bottomBar) {
    return (
      <nav
        className="flex w-full touch-manipulation items-center gap-1 overflow-x-auto bg-background px-2 py-2 [-webkit-tap-highlight-color:transparent]"
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
              className={`flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 transition-colors duration-75 ease-out active:opacity-80 ${
                isActive
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className={`text-[8px] font-semibold uppercase leading-none ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {tool.label.slice(0, 5)}
              </span>
            </button>
          );
        })}

        <div className="mx-1 h-6 w-px shrink-0 bg-border" />

        <button
          type="button"
          onClick={onAddLayer}
          title="Nytt lag"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors duration-75 hover:bg-muted hover:text-foreground active:opacity-80"
        >
          <Plus className="size-[18px]" aria-hidden />
        </button>

        <button
          type="button"
          title={isLayerVisible ? "Skjul lag" : "Vis lag"}
          onClick={() => {
            if (activeLayerId) onToggleLayer(activeLayerId);
          }}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors duration-75 hover:bg-muted hover:text-foreground active:opacity-80"
        >
          {isLayerVisible ? <Eye className="size-[18px]" aria-hidden /> : <EyeOff className="size-[18px]" aria-hidden />}
        </button>

        <button
          type="button"
          title="Tøm aktivt lag"
          onClick={onClearActiveLayer}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-destructive/30 bg-background text-destructive/80 transition-colors duration-75 hover:bg-destructive/10 hover:text-destructive active:opacity-80"
        >
          <Trash2 className="size-[18px]" aria-hidden />
        </button>

        {onTogglePanel && (
          <>
            <div className="mx-1 h-6 w-px shrink-0 bg-border" />
            <button
              type="button"
              onClick={onTogglePanel}
              title={panelOpen ? "Skjul panel" : "Vis panel"}
              className={`relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-75 active:opacity-80 ${
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

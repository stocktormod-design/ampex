"use client";

import { useMemo, useState } from "react";

type ToolId = "select" | "detector" | "line" | "rect" | "text" | "erase";

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

export function PaintToolbar() {
  const [activeTool, setActiveTool] = useState<ToolId>("select");
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
              onClick={() => setActiveTool(tool.id)}
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
      </div>
    </aside>
  );
}

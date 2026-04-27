"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { updateDrawingSettings } from "@/app/dashboard/projects/actions";

const DISCIPLINE_OPTIONS = [
  { id: "fire", label: "Brann" },
  { id: "power", label: "Sterkstrøm" },
  { id: "low_voltage", label: "Svakstrøm" },
] as const;

type Member = { id: string; fullName: string | null };

type Props = {
  projectId: string;
  drawingId: string;
  drawingName: string;
  members: Member[];
  initialDisciplines: string[];
  initialVisibleToUserIds: string[] | null;
};

export function DrawingSettingsDialog({
  projectId,
  drawingId,
  drawingName,
  members,
  initialDisciplines,
  initialVisibleToUserIds,
}: Props) {
  const [open, setOpen] = useState(false);
  const [disciplines, setDisciplines] = useState<Set<string>>(() => new Set(initialDisciplines));
  const [visibleSelection, setVisibleSelection] = useState<string[] | null>(initialVisibleToUserIds);
  const allVisible = visibleSelection === null;

  function toggleDiscipline(id: string) {
    setDisciplines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMemberVisibility(id: string) {
    if (allVisible) {
      setVisibleSelection([id]);
      return;
    }
    const next = visibleSelection.includes(id)
      ? visibleSelection.filter((x) => x !== id)
      : [...visibleSelection, id];
    setVisibleSelection(next.length === 0 ? null : next);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Innstillinger for tegning"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Settings2 className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Innstillinger</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="drawing-settings-title">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Lukk" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <h2 id="drawing-settings-title" className="text-lg font-semibold text-foreground">
              Innstillinger
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{drawingName}</p>

            <form
              action={updateDrawingSettings}
              className="mt-5 space-y-6"
              onSubmit={() => setOpen(false)}
            >
              <input type="hidden" name="drawing_id" value={drawingId} />
              <input type="hidden" name="project_id" value={projectId} />
              <input
                type="hidden"
                name="visible_to_user_ids"
                value={allVisible ? "" : JSON.stringify(visibleSelection ?? [])}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Fagområde / tag</p>
                <p className="text-xs text-muted-foreground">Velg ett eller flere. «Brann» aktiverer detektorrapport fra prosjektlisten.</p>
                {Array.from(disciplines).map((id) => (
                  <input key={id} type="hidden" name="discipline" value={id} />
                ))}
                <div className="flex flex-wrap gap-2">
                  {DISCIPLINE_OPTIONS.map((opt) => {
                    const on = disciplines.has(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleDiscipline(opt.id)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          on ? "border-primary/40 bg-primary/10 font-semibold text-primary" : "border-border bg-background text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {members.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Synlig for</p>
                  <p className="text-xs text-muted-foreground">«Alle med tilgang» følger tegningstilgang på prosjektet.</p>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setVisibleSelection(null)}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        allVisible ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${allVisible ? "border-primary bg-primary" : "border-border"}`}>
                        {allVisible ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                      </span>
                      <span className="font-semibold">Alle med tilgang</span>
                    </button>
                    {members.map((m) => {
                      const checked = !allVisible && (visibleSelection?.includes(m.id) ?? false);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMemberVisibility(m.id)}
                          className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                            checked ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2 ${
                              checked ? "border-primary bg-primary/15" : "border-border bg-muted"
                            }`}
                          >
                            {checked ? (
                              <svg className="h-2.5 w-2.5 text-primary" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                              </svg>
                            ) : null}
                          </span>
                          <span>{m.fullName ?? "Ukjent"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Lagre
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

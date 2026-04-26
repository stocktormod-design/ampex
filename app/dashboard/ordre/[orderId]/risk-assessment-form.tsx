"use client";

import { useRef, useState } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { saveRiskAssessment } from "@/app/dashboard/ordre/actions";

export type RiskModule = {
  id: string;
  name: string;
  items: { id: string; text: string; is_required: boolean }[];
};

type ItemState = {
  checked: boolean;
  na: boolean;
  notes: string;
};

type RiskPayload = {
  version: "risk-modular";
  job_description: string;
  location: string;
  work_date: string;
  participants: string;
  approved_by: string;
  additional_notes: string;
  checklist: Record<string, ItemState>;
};

function defaultChecklist(modules: RiskModule[]): Record<string, ItemState> {
  const entries: Record<string, ItemState> = {};
  for (const mod of modules) {
    for (const item of mod.items) {
      entries[item.id] = { checked: false, na: false, notes: "" };
    }
  }
  return entries;
}

function parsePayload(raw: Record<string, unknown> | null, modules: RiskModule[]): RiskPayload {
  const defaults = defaultChecklist(modules);
  if (raw?.version === "risk-modular") {
    const typed = raw as unknown as RiskPayload;
    return {
      ...typed,
      checklist: { ...defaults, ...(typed.checklist ?? {}) },
    };
  }
  return {
    version: "risk-modular",
    job_description: "",
    location: "",
    work_date: "",
    participants: "",
    approved_by: "",
    additional_notes: "",
    checklist: defaults,
  };
}

type Props = {
  orderId: string;
  modules: RiskModule[];
  existingPayload: Record<string, unknown> | null;
  isCompleted: boolean;
};

export function RiskAssessmentForm({ orderId, modules, existingPayload, isCompleted }: Props) {
  const [state, setState] = useState<RiskPayload>(() => parsePayload(existingPayload, modules));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [warnIncomplete, setWarnIncomplete] = useState(false);
  const hiddenRef = useRef<HTMLTextAreaElement>(null);

  function setField<K extends keyof RiskPayload>(key: K, value: RiskPayload[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function setItem(id: string, patch: Partial<ItemState>) {
    setState((prev) => ({
      ...prev,
      checklist: { ...prev.checklist, [id]: { ...prev.checklist[id], ...patch } },
    }));
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const allItems = modules.flatMap((m) => m.items);
  const requiredItems = allItems.filter((i) => i.is_required);
  const checkedRequired = requiredItems.filter((i) => state.checklist[i.id]?.checked);
  const totalChecked = allItems.filter(
    (i) => state.checklist[i.id]?.checked || state.checklist[i.id]?.na,
  ).length;
  const allRequiredDone = checkedRequired.length === requiredItems.length;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const completing = submitter?.value === "1";
    if (completing && !allRequiredDone) {
      e.preventDefault();
      setWarnIncomplete(true);
      return;
    }
    setWarnIncomplete(false);
    if (hiddenRef.current) {
      hiddenRef.current.value = JSON.stringify(state);
    }
  }

  if (modules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <Settings className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Ingen risikovurderingsmoduler opprettet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gå til innstillinger og opprett moduler med sjekkpunkter.
        </p>
        <a
          href="/dashboard/settings/risk-modules"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
        >
          <Settings className="size-3.5" />
          Administrer moduler
        </a>
      </div>
    );
  }

  return (
    <form action={saveRiskAssessment} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="order_id" value={orderId} />
      <textarea ref={hiddenRef} name="payload_json" className="hidden" defaultValue="{}" readOnly />

      {/* Progress */}
      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>{totalChecked} av {allItems.length} punkter behandlet</span>
          <span className="font-medium text-foreground">
            {checkedRequired.length}/{requiredItems.length} obligatoriske
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{
              width: `${allItems.length > 0 ? (totalChecked / allItems.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Header info */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Arbeidsbeskrivelse *</label>
          <textarea
            rows={3}
            value={state.job_description}
            onChange={(e) => setField("job_description", e.target.value)}
            placeholder="Beskriv arbeidet som skal utføres…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Arbeidssted / Lokasjon *</label>
          <textarea
            rows={3}
            value={state.location}
            onChange={(e) => setField("location", e.target.value)}
            placeholder="Adresse eller beskrivelse av stedet…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Planlagt dato</label>
          <input
            type="date"
            value={state.work_date}
            onChange={(e) => setField("work_date", e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Deltakere</label>
          <input
            type="text"
            value={state.participants}
            onChange={(e) => setField("participants", e.target.value)}
            placeholder="Navn på alle som deltar…"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Godkjent av (ansvarlig) *</label>
          <input
            type="text"
            value={state.approved_by}
            onChange={(e) => setField("approved_by", e.target.value)}
            placeholder="Fullt navn på ansvarlig person…"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Modules / Checklists */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Sjekkliste</h3>
        {modules.map((mod) => {
          const isCollapsed = collapsed[mod.id];
          const modItems = mod.items;
          const catDone = modItems.filter(
            (i) => state.checklist[i.id]?.checked || state.checklist[i.id]?.na,
          ).length;
          const allCatDone = catDone === modItems.length;

          return (
            <div key={mod.id} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => toggleCollapse(mod.id)}
                className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{mod.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      allCatDone
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {catDone}/{modItems.length}
                  </span>
                </div>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                />
              </button>

              {!isCollapsed && modItems.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Ingen sjekkpunkter i denne modulen.{" "}
                  <a href="/dashboard/settings/risk-modules" className="underline hover:text-foreground">
                    Legg til punkter
                  </a>
                </div>
              )}

              {!isCollapsed && modItems.length > 0 && (
                <div className="divide-y divide-border">
                  {modItems.map((item) => {
                    const entry = state.checklist[item.id] ?? {
                      checked: false,
                      na: false,
                      notes: "",
                    };
                    const isNa = entry.na;
                    const isChecked = entry.checked;

                    return (
                      <div
                        key={item.id}
                        className={`px-4 py-3 ${
                          isChecked
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                            : isNa
                              ? "bg-muted/30"
                              : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            id={`item-${item.id}`}
                            checked={isChecked}
                            disabled={isNa}
                            onChange={(e) =>
                              setItem(item.id, { checked: e.target.checked, na: false })
                            }
                            className="mt-0.5 size-4 shrink-0 accent-emerald-600 disabled:opacity-40"
                          />
                          <div className="min-w-0 flex-1">
                            <label
                              htmlFor={`item-${item.id}`}
                              className={`cursor-pointer text-sm leading-snug ${
                                isNa ? "text-muted-foreground line-through" : ""
                              }`}
                            >
                              {item.text}
                              {item.is_required && !isNa && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  (obligatorisk)
                                </span>
                              )}
                            </label>
                            {(isChecked || entry.notes) && (
                              <input
                                type="text"
                                value={entry.notes}
                                onChange={(e) => setItem(item.id, { notes: e.target.value })}
                                placeholder="Kommentar / avvik…"
                                className="mt-2 h-8 w-full rounded-lg border border-input bg-background px-2 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            )}
                          </div>
                          {!item.is_required && (
                            <button
                              type="button"
                              onClick={() =>
                                setItem(item.id, { na: !isNa, checked: false, notes: "" })
                              }
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                isNa
                                  ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                  : "border border-border bg-background text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              N/A
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Additional notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Ytterligere merknader / avvik / tiltak
        </label>
        <textarea
          rows={3}
          value={state.additional_notes}
          onChange={(e) => setField("additional_notes", e.target.value)}
          placeholder="Beskriv avvik, observasjoner eller tiltak som ikke dekkes av sjekklisten…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {warnIncomplete && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          {requiredItems.length - checkedRequired.length} obligatoriske punkt er ikke krysset av.
          Kryss av eller legg til merknad før du markerer som fullført.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="complete"
          value="0"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Lagre utkast
        </button>
        <button
          type="submit"
          name="complete"
          value="1"
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/85"
        >
          Marker som fullført
        </button>
        {isCompleted && !warnIncomplete && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Fullført</span>
        )}
        {!allRequiredDone && allItems.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {requiredItems.length - checkedRequired.length} obligatoriske gjenstår
          </span>
        )}
      </div>
    </form>
  );
}

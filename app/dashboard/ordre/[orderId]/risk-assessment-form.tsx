"use client";

import { useRef, useState, useCallback } from "react";
import { ChevronDown, Settings, CheckCircle2, ChevronsUpDown } from "lucide-react";
import { saveRiskAssessment } from "@/app/dashboard/ordre/actions";

export type RiskModule = {
  id: string;
  name: string;
  items: { id: string; text: string; is_required: boolean }[];
};

type ItemState = { checked: boolean; na: boolean; notes: string };

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

function buildDefaults(modules: RiskModule[]): Record<string, ItemState> {
  const out: Record<string, ItemState> = {};
  for (const mod of modules)
    for (const item of mod.items)
      out[item.id] = { checked: false, na: false, notes: "" };
  return out;
}

function parsePayload(raw: Record<string, unknown> | null, modules: RiskModule[]): RiskPayload {
  const defaults = buildDefaults(modules);
  if (raw?.version === "risk-modular") {
    const typed = raw as unknown as RiskPayload;
    return { ...typed, checklist: { ...defaults, ...(typed.checklist ?? {}) } };
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

const fieldCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  orderId: string;
  modules: RiskModule[];
  existingPayload: Record<string, unknown> | null;
  isCompleted: boolean;
};

export function RiskAssessmentForm({ orderId, modules, existingPayload, isCompleted }: Props) {
  const [state, setState] = useState<RiskPayload>(() => parsePayload(existingPayload, modules));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(true);
  const [warnIncomplete, setWarnIncomplete] = useState(false);
  const hiddenRef = useRef<HTMLTextAreaElement>(null);

  const setField = useCallback(<K extends keyof RiskPayload>(key: K, value: RiskPayload[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setItem = useCallback((id: string, patch: Partial<ItemState>) => {
    setState((prev) => ({
      ...prev,
      checklist: { ...prev.checklist, [id]: { ...prev.checklist[id], ...patch } },
    }));
  }, []);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAllExpand() {
    if (allExpanded) {
      const all: Record<string, boolean> = {};
      for (const mod of modules) all[mod.id] = true;
      setCollapsed(all);
    } else {
      setCollapsed({});
    }
    setAllExpanded((v) => !v);
  }

  function markModuleNa(moduleId: string) {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    setState((prev) => {
      const next = { ...prev.checklist };
      for (const item of mod.items) {
        if (!item.is_required) next[item.id] = { checked: false, na: true, notes: "" };
      }
      return { ...prev, checklist: next };
    });
  }

  const allItems = modules.flatMap((m) => m.items);
  const requiredItems = allItems.filter((i) => i.is_required);
  const checkedRequired = requiredItems.filter((i) => state.checklist[i.id]?.checked);
  const totalHandled = allItems.filter(
    (i) => state.checklist[i.id]?.checked || state.checklist[i.id]?.na,
  ).length;
  const allRequiredDone = checkedRequired.length === requiredItems.length;
  const progress = allItems.length > 0 ? Math.round((totalHandled / allItems.length) * 100) : 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "1" && !allRequiredDone) {
      e.preventDefault();
      setWarnIncomplete(true);
      // Expand any module that has unchecked required items
      const expand: Record<string, boolean> = { ...collapsed };
      for (const mod of modules) {
        const hasUnchecked = mod.items.some(
          (i) => i.is_required && !state.checklist[i.id]?.checked,
        );
        if (hasUnchecked) delete expand[mod.id];
      }
      setCollapsed(expand);
      return;
    }
    setWarnIncomplete(false);
    if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(state);
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (modules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 px-6 py-12 text-center">
        <Settings className="mx-auto mb-3 size-9 text-muted-foreground/30" />
        <p className="text-sm font-semibold">Ingen sjekklistemoduler opprettet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Opprett moduler under Innstillinger → Sjekklister.
        </p>
        <a
          href="/dashboard/settings/risk-modules"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/85"
        >
          <Settings className="size-3.5" />
          Gå til sjekklister
        </a>
      </div>
    );
  }

  return (
    <form action={saveRiskAssessment} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="order_id" value={orderId} />
      <textarea ref={hiddenRef} name="payload_json" className="hidden" defaultValue="{}" readOnly />

      {/* ── Progress ── */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">
              {totalHandled} av {allItems.length} punkt behandlet
            </span>
            <span
              className={`font-semibold ${allRequiredDone ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
            >
              {checkedRequired.length}/{requiredItems.length} obligatoriske
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allRequiredDone ? "bg-emerald-500" : "bg-foreground"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {allRequiredDone && (
          <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
        )}
      </div>

      {/* ── Header info ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Arbeidsbeskrivelse *</label>
          <textarea
            rows={3}
            value={state.job_description}
            onChange={(e) => setField("job_description", e.target.value)}
            placeholder="Beskriv arbeidet som skal utføres…"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Arbeidssted / Lokasjon *</label>
          <textarea
            rows={3}
            value={state.location}
            onChange={(e) => setField("location", e.target.value)}
            placeholder="Adresse eller beskrivelse av stedet…"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Planlagt dato</label>
          <input
            type="date"
            value={state.work_date}
            onChange={(e) => setField("work_date", e.target.value)}
            className={`${fieldCls} h-10 py-0`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Deltakere</label>
          <input
            type="text"
            value={state.participants}
            onChange={(e) => setField("participants", e.target.value)}
            placeholder="Navn på alle som deltar…"
            className={`${fieldCls} h-10`}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Godkjent av (ansvarlig) *</label>
          <input
            type="text"
            value={state.approved_by}
            onChange={(e) => setField("approved_by", e.target.value)}
            placeholder="Fullt navn på ansvarlig person…"
            className={`${fieldCls} h-10`}
          />
        </div>
      </div>

      {/* ── Checklist ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Sjekkliste</h3>
          <button
            type="button"
            onClick={toggleAllExpand}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronsUpDown className="size-3.5" />
            {allExpanded ? "Skjul alle" : "Utvid alle"}
          </button>
        </div>

        <div className="space-y-2">
          {modules.map((mod) => {
            const isCollapsed = collapsed[mod.id];
            const catDone = mod.items.filter(
              (i) => state.checklist[i.id]?.checked || state.checklist[i.id]?.na,
            ).length;
            const allCatDone = catDone === mod.items.length && mod.items.length > 0;
            const hasOptionalOnly = mod.items.every((i) => !i.is_required);
            const anyUncheckedRequired = mod.items.some(
              (i) => i.is_required && !state.checklist[i.id]?.checked,
            );
            const isWarn = warnIncomplete && anyUncheckedRequired;

            return (
              <div
                key={mod.id}
                className={`overflow-hidden rounded-xl border transition-colors ${
                  isWarn ? "border-amber-400 dark:border-amber-600" : "border-border"
                }`}
              >
                {/* Module header */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(mod.id)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                    allCatDone
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                      : isWarn
                        ? "bg-amber-50/60 dark:bg-amber-950/20"
                        : "bg-muted/25 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {allCatDone && <CheckCircle2 className="size-4 text-emerald-500" />}
                    <span className="text-sm font-semibold">{mod.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        allCatDone
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : isWarn
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {catDone}/{mod.items.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* N/A all optional — only show if module has optional items */}
                    {hasOptionalOnly && !isCollapsed && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); markModuleNa(mod.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); markModuleNa(mod.id); } }}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                      >
                        Alle N/A
                      </span>
                    )}
                    <ChevronDown
                      className={`size-4 text-muted-foreground transition-transform ${
                        isCollapsed ? "-rotate-90" : ""
                      }`}
                    />
                  </div>
                </button>

                {!isCollapsed && mod.items.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Ingen sjekkpunkter.{" "}
                    <a
                      href="/dashboard/settings/risk-modules"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Legg til
                    </a>
                  </div>
                )}

                {!isCollapsed && mod.items.length > 0 && (
                  <div className="divide-y divide-border/60">
                    {mod.items.map((item) => {
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
                          className={`px-4 py-2.5 transition-colors ${
                            isChecked
                              ? "bg-emerald-50/40 dark:bg-emerald-950/15"
                              : isNa
                                ? "bg-muted/20"
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
                              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-30"
                            />
                            <div className="min-w-0 flex-1">
                              <label
                                htmlFor={`item-${item.id}`}
                                className={`cursor-pointer text-sm leading-snug ${
                                  isNa
                                    ? "text-muted-foreground/50 line-through"
                                    : isChecked
                                      ? "text-foreground"
                                      : ""
                                }`}
                              >
                                {item.text}
                                {item.is_required && !isNa && (
                                  <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                    ⚠ OBL.
                                  </span>
                                )}
                              </label>
                              {(isChecked || entry.notes) && !isNa && (
                                <input
                                  type="text"
                                  value={entry.notes}
                                  onChange={(e) => setItem(item.id, { notes: e.target.value })}
                                  placeholder="Kommentar / avvik…"
                                  className="mt-1.5 h-7 w-full rounded-lg border border-input bg-background px-2 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                    ? "bg-muted text-muted-foreground"
                                    : "border border-border bg-background text-muted-foreground/60 hover:bg-muted"
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
      </div>

      {/* ── Additional notes ── */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Ytterligere merknader / avvik / tiltak
        </label>
        <textarea
          rows={3}
          value={state.additional_notes}
          onChange={(e) => setField("additional_notes", e.target.value)}
          placeholder="Beskriv avvik, observasjoner eller tiltak som ikke dekkes av sjekklisten…"
          className={fieldCls}
        />
      </div>

      {/* ── Incomplete warning ── */}
      {warnIncomplete && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          {requiredItems.length - checkedRequired.length} obligatoriske punkt er ikke avkrysset.
          Modulene er markert gult ovenfor.
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
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
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            allRequiredDone
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-foreground text-background hover:bg-foreground/85"
          }`}
        >
          Marker som fullført
        </button>
        {isCompleted && !warnIncomplete && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Fullført
          </span>
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

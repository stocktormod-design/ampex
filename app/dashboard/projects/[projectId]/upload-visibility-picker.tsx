"use client";

import { useState } from "react";

type Member = { id: string; fullName: string | null };

export function UploadVisibilityPicker({ members }: { members: Member[] }) {
  const [selected, setSelected] = useState<string[] | null>(null);
  const allSelected = selected === null;

  function toggle(id: string) {
    if (allSelected) {
      setSelected([id]);
      return;
    }
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    setSelected(next.length === 0 ? null : next);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Synlig for</p>
      <input
        type="hidden"
        name="visible_to_user_ids"
        value={allSelected ? "" : JSON.stringify(selected)}
      />
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
            allSelected
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${allSelected ? "border-primary bg-primary" : "border-border"}`}>
            {allSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
          </span>
          <span className="font-semibold">Alle med tilgang</span>
        </button>
        {members.map((m) => {
          const checked = !allSelected && selected.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                checked
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border-2 transition-all ${checked ? "border-primary bg-primary/15" : "border-border bg-muted"}`}>
                {checked && (
                  <svg className="h-2.5 w-2.5 text-primary" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </span>
              <span>{m.fullName ?? "Ukjent"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

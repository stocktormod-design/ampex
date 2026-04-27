"use client";

import { DISCIPLINE_OPTIONS, DISCIPLINE_STYLE } from "./drawing-discipline-meta";

export function DisciplineChips({ ids }: { ids: readonly string[] }) {
  return ids.map((id) => {
    const opt = DISCIPLINE_OPTIONS.find((o) => o.id === id);
    if (!opt) return null;
    const style = DISCIPLINE_STYLE[id] ?? "";
    return (
      <span
        key={id}
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}
      >
        {opt.label}
      </span>
    );
  });
}

"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Pencil, Eye, Archive } from "lucide-react";
import { archiveDrawing } from "@/app/dashboard/projects/actions";
import { DisciplineChips } from "@/app/dashboard/projects/[projectId]/discipline-chips";

type DrawingRow = {
  id: string;
  name: string;
  revision: string | null;
  file_path: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  drawing_status: string;
  pipeline: string;
  is_archived: boolean;
  revision_group_id: string | null;
  disciplines: string[];
  visible_to_user_ids?: string[] | null;
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

type Props = {
  projectId: string;
  head: DrawingRow;
  older: DrawingRow[];
  isAdmin: boolean;
  showCurrentBadge: boolean;
  headActions: ReactNode;
};

export function DrawingRevisionGroup({
  projectId,
  head,
  older,
  isAdmin,
  showCurrentBadge,
  headActions,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasOlder = older.length > 0;

  return (
    <li className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
        {hasOlder ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-expanded={expanded}
            title={expanded ? "Skjul tidligere revisjoner" : "Vis tidligere revisjoner"}
          >
            <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </button>
        ) : (
          <span className="w-9 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium text-foreground">{head.name}</p>
            {showCurrentBadge && hasOlder ? (
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                Nyeste
              </span>
            ) : null}
            <DisciplineChips ids={Array.isArray(head.disciplines) ? head.disciplines : []} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {head.revision ? `Rev. ${head.revision} · ` : ""}
            {fmtDate(head.created_at)}
            {head.pipeline === "official" && head.published_at && head.published_at !== head.created_at && (
              <> · Publisert {fmtDate(head.published_at)}</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{headActions}</div>
      </div>

      {expanded && hasOlder ? (
        <ul className="border-t border-border bg-muted/25">
          {older.map((row) => (
            <li key={row.id} className="flex items-center gap-3 border-b border-border/80 px-4 py-3 pl-14 last:border-b-0 sm:px-5 sm:pl-16">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Tidligere
                  </span>
                  {row.revision ? (
                    <span className="text-xs font-medium text-foreground">Rev. {row.revision}</span>
                  ) : null}
                  <DisciplineChips ids={Array.isArray(row.disciplines) ? row.disciplines : []} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fmtDate(row.created_at)}
                  {row.published_at ? <> · Publisert {fmtDate(row.published_at)}</> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link
                  href={`/dashboard/projects/${projectId}/drawings/${row.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-medium hover:bg-muted"
                >
                  <Pencil className="size-3" aria-hidden />
                  Editor
                </Link>
                <Link
                  href={`/dashboard/projects/${projectId}/drawings/${row.id}/view`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-medium hover:bg-muted"
                >
                  <Eye className="size-3" aria-hidden />
                  Vis
                </Link>
                {isAdmin ? (
                  <form action={archiveDrawing}>
                    <input type="hidden" name="drawing_id" value={row.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                    >
                      <Archive className="size-3" aria-hidden />
                      Arkiver
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

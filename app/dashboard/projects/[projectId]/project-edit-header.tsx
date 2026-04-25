"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";
import { updateProject } from "@/app/dashboard/projects/actions";

type Props = {
  projectId: string;
  name: string;
  description: string | null;
  statusBadge: React.ReactNode;
  meta: React.ReactNode;
  actionButton: React.ReactNode;
};

export function ProjectEditHeader({ projectId, name, description, statusBadge, meta, actionButton }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{name}</h1>
            {statusBadge}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
              aria-label="Rediger prosjektnavn"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
          <div className="mt-1">{meta}</div>
        </div>
        {actionButton}
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        startTransition(() => updateProject(fd));
        setEditing(false);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="project_id" value={projectId} />

      <div className="space-y-2">
        <input
          name="name"
          defaultValue={name}
          required
          autoFocus
          placeholder="Prosjektnavn"
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-lg font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xl"
        />
        <textarea
          name="description"
          defaultValue={description ?? ""}
          rows={2}
          placeholder="Beskrivelse (valgfritt)"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/80 disabled:opacity-50"
        >
          <Check className="size-3.5" />
          Lagre
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
          Avbryt
        </button>
      </div>
    </form>
  );
}

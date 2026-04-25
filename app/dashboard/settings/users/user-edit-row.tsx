"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";
import { updateUser } from "./actions";

type Props = {
  user: {
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string;
  };
  currentUserId: string;
  currentUserRole: string;
  deleteSlot: React.ReactNode;
};

const ROLES = [
  { value: "montor", label: "Montør" },
  { value: "apprentice", label: "Lærling" },
  { value: "installator", label: "Installatør" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
] as const;

function roleColor(role: string) {
  if (role === "owner") return "bg-primary/10 text-primary";
  if (role === "admin") return "bg-secondary text-secondary-foreground";
  if (role === "installator") return "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
  if (role === "apprentice") return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export function UserEditRow({ user, currentUserId, currentUserRole, deleteSlot }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const isSelf = user.id === currentUserId;
  const canEdit =
    (currentUserRole === "owner" || currentUserRole === "admin") &&
    user.role !== "owner";

  if (!editing) {
    return (
      <li className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
          {(user.full_name?.trim()[0] ?? "?").toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">
            {user.full_name?.trim() || "Uten navn"}
            {isSelf && <span className="ml-2 text-xs text-muted-foreground">(deg)</span>}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {user.phone?.trim() || "—"}
          </p>
        </div>

        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColor(user.role)}`}>
          {roleLabel(user.role)}
        </span>

        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Rediger bruker"
          >
            <Pencil className="size-3.5" />
          </button>
        )}

        <div className="shrink-0">{deleteSlot}</div>
      </li>
    );
  }

  return (
    <li className="px-4 py-4 sm:px-5">
      <form
        action={(fd) => {
          startTransition(() => updateUser(fd));
          setEditing(false);
        }}
        className="space-y-3"
      >
        <input type="hidden" name="user_id" value={user.id} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Navn</label>
            <input
              name="full_name"
              defaultValue={user.full_name ?? ""}
              required
              autoFocus
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Telefon</label>
            <input
              name="phone"
              defaultValue={user.phone ?? ""}
              type="tel"
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rolle</label>
            <select
              name="role"
              defaultValue={user.role}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ROLES.filter((r) => r.value !== "owner" || currentUserRole === "owner").map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
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
    </li>
  );
}

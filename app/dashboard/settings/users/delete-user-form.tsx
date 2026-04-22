"use client";

import { deleteUser } from "@/app/dashboard/settings/users/actions";

type Props = {
  userId: string;
  displayName: string;
  disabled?: boolean;
};

export function DeleteUserForm({ userId, displayName, disabled }: Props) {
  return (
    <form
      action={deleteUser}
      onSubmit={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        const ok = window.confirm(
          `Slette brukeren «${displayName}»? Dette kan ikke angres, og innloggingen stoppes umiddelbart.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="user_id" value={userId} />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
      >
        Slett
      </button>
    </form>
  );
}

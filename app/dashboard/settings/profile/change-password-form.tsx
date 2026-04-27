"use client";

import { useState } from "react";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { changePassword } from "./actions";

export function ChangePasswordForm({
  pwError,
  pwSuccess,
}: {
  pwError?: string;
  pwSuccess?: boolean;
}) {
  const [mismatch, setMismatch] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const newPw = String(fd.get("new_password") ?? "");
    const confirmPw = String(fd.get("confirm_password") ?? "");
    if (newPw !== confirmPw) {
      e.preventDefault();
      setMismatch(true);
    } else {
      setMismatch(false);
    }
  }

  const errorMsg = mismatch ? "Passordene stemmer ikke overens." : pwError;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">Bytt passord</h2>

      {errorMsg && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </p>
      )}
      {pwSuccess && !errorMsg && (
        <p className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Passord er endret.
        </p>
      )}

      <form action={changePassword} onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <NativeLabel htmlFor="current_password">Nåværende passord</NativeLabel>
          <NativeInput
            id="current_password"
            name="current_password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <NativeLabel htmlFor="new_password">Nytt passord</NativeLabel>
            <NativeInput
              id="new_password"
              name="new_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Minst 8 tegn"
            />
          </div>
          <div className="space-y-2">
            <NativeLabel htmlFor="confirm_password">Bekreft nytt passord</NativeLabel>
            <NativeInput
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>
        <SubmitButton>Endre passord</SubmitButton>
      </form>
    </div>
  );
}

"use server";

import { redirect } from "next/navigation";
import { debugLog } from "@/lib/debug";
import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  debugLog("auth.signIn", {
    hasError: Boolean(error),
    errorMessage: error?.message ?? null,
    nextTarget: next,
    emailDomain: email.includes("@") ? email.split("@")[1] ?? "?" : "invalid",
  });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
}

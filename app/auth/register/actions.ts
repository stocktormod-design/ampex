"use server";

import { redirect } from "next/navigation";
import { debugLog } from "@/lib/debug";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  const phone = String(formData.get("phone") ?? "");

  const supabase = await createClient();
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const callbackUrl = `${baseUrl}/auth/callback`;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl,
      data: {
        full_name: fullName,
        phone,
      },
    },
  });

  debugLog("auth.signUp", {
    hasError: Boolean(error),
    errorMessage: error?.message ?? null,
    callbackHost: (() => {
      try {
        return new URL(callbackUrl).host;
      } catch {
        return "ugyldig";
      }
    })(),
    emailDomain: email.includes("@") ? email.split("@")[1] ?? "?" : "invalid",
  });

  if (error) {
    redirect(`/auth/register?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/auth/register?success=1");
}

import { type NextRequest, NextResponse } from "next/server";
import { debugLog } from "@/lib/debug";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    debugLog("auth.callback", {
      hasCode: true,
      exchangeError: error?.message ?? null,
      nextParam: next,
    });
  } else {
    debugLog("auth.callback", { hasCode: false, nextParam: next });
  }

  const redirectUrl = new URL(next, request.url);
  return NextResponse.redirect(redirectUrl);
}

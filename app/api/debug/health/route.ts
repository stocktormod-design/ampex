import { NextResponse } from "next/server";
import { isAmpexDebugEnabled } from "@/lib/debug";

export const dynamic = "force-dynamic";

function safeSupabaseHost(raw: string | undefined): string | null {
  const u = raw?.trim();
  if (!u) return null;
  try {
    return new URL(u).hostname;
  } catch {
    return "ugyldig-url";
  }
}

export async function GET() {
  if (!isAmpexDebugEnabled()) {
    return NextResponse.json({ error: "Feilsøk er av (sett AMPEX_DEBUG=1)." }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return NextResponse.json({
    ok: true,
    hint: "Sjekk Vercel → Logs med søk etter [ampex:debug]. Fjern AMPEX_DEBUG når du er ferdig.",
    time: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercel: {
      env: process.env.VERCEL_ENV ?? null,
      url: process.env.VERCEL_URL ?? null,
      region: process.env.VERCEL_REGION ?? null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(supabaseUrl),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(anon),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(service),
      NEXT_PUBLIC_APP_URL: Boolean(appUrl),
    },
    preview: {
      supabaseHost: safeSupabaseHost(supabaseUrl),
      appUrlOrigin: appUrl ? safeOrigin(appUrl) : null,
    },
  });
}

function safeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return "ugyldig NEXT_PUBLIC_APP_URL";
  }
}

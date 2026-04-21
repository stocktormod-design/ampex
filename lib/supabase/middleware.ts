import { NextResponse, type NextRequest } from "next/server";

/**
 * Midlertidig no-op etter frontend-reset.
 * Legg inn cookie-refresh + route-guards her nar auth bygges pa nytt
 * (se tidligere monster med createServerClient fra @supabase/ssr).
 */
export function updateSession(request: NextRequest) {
  void request;
  return NextResponse.next();
}

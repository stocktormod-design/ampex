import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { debugLog } from "@/lib/debug";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Ikke kjor Supabase cookie-refresh pa /auth/* — unngar Edge-problemer pa innlogging.
  if (pathname.startsWith("/auth")) {
    debugLog("middleware", { pathname, branch: "auth-skip-supabase" });
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    debugLog("middleware", { pathname, branch: "missing-supabase-env" });
    return NextResponse.next();
  }

  try {
    let response = NextResponse.next();

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isProtectedRoute =
      pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");

    if (!user && isProtectedRoute) {
      debugLog("middleware", {
        pathname,
        branch: "redirect-login",
        hasUser: false,
        nextParam: pathname,
      });
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/login";
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    debugLog("middleware", {
      pathname,
      branch: "ok",
      hasUser: Boolean(user),
      protectedRoute: isProtectedRoute,
    });
    return response;
  } catch (e) {
    debugLog("middleware", {
      pathname,
      branch: "catch-fallback-next",
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.next();
  }
}

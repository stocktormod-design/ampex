import Link from "next/link";
import { signInWithPassword } from "@/app/auth/login/actions";
import { safeNextPath } from "@/lib/safe-next-path";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string }> | { error?: string; next?: string };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = searchParams instanceof Promise ? await searchParams : searchParams;
  const nextPath = safeNextPath(sp?.next);

  return (
    <div className="flex min-h-dvh">
      {/* ── Left: branding panel (desktop only) ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 px-14 py-12 lg:flex lg:w-[52%]">
        {/* Subtle grid background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Logo */}
        <span className="relative text-lg font-bold tracking-tight text-white">Ampex</span>

        {/* Hero copy */}
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
            Verktøy for elektrobransjen
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-white">
            Fra tegnebordet<br />til feltet.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-zinc-400">
            Tegningseditor med overlay, branndetektor-sjekkliste og lager med
            strekkode — alt i ett verktøy, optimert for montører på jobb.
          </p>

          {/* Feature bullets */}
          <ul className="mt-8 space-y-3">
            {[
              "PDF-tegninger med live-overlay og lag",
              "Branndetektor-sjekkliste med foto",
              "Lager og strekkodeskanning",
              "Mobilvennlig — fungerer på felt",
            ].map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-zinc-300">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400"
                  fill="none"
                  viewBox="0 0 16 16"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom copy */}
        <p className="relative text-xs text-zinc-700">© {new Date().getFullYear()} Ampex</p>
      </div>

      {/* ── Right: login form ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-10 text-center lg:hidden">
          <span className="text-xl font-bold tracking-tight">Ampex</span>
          <p className="mt-1 text-sm text-muted-foreground">Logg inn for å fortsette</p>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">Logg inn</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bruk e-posten og passordet du fikk av administrator.
          </p>

          <form action={signInWithPassword} className="mt-8 space-y-4">
            <input type="hidden" name="next" value={nextPath} />

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                E-post
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Passord
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {sp?.error && (
              <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {sp.error}
              </p>
            )}

            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80"
            >
              Logg inn
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ingen konto?{" "}
            <Link href="/auth/register" className="font-medium text-foreground underline-offset-4 hover:underline">
              Kontakt administrator
            </Link>
          </p>
          <p className="mt-3 text-center">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Tilbake til forsiden
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { signInWithPassword } from "@/app/auth/login/actions";
import { safeNextPath } from "@/lib/safe-next-path";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string }> | { error?: string; next?: string };
};

const inputClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = searchParams instanceof Promise ? await searchParams : searchParams;
  const nextPath = safeNextPath(sp?.next);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">Logg inn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bruk e-post og passord fra administratoren.
        </p>

        <form action={signInWithPassword} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              E-post
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Passord
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          {sp?.error ? (
            <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {sp.error}
            </p>
          ) : null}
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Logg inn
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Ny bruker?{" "}
          <Link href="/auth/register" className="font-medium text-primary hover:underline">
            Opprett konto
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground hover:underline">
            Tilbake til forsiden
          </Link>
        </p>
      </div>
    </main>
  );
}

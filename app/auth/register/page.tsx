import Link from "next/link";
import { signUp } from "@/app/auth/register/actions";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }> | { error?: string; success?: string };
};

const inputClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring";

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const sp = searchParams instanceof Promise ? await searchParams : searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight">Opprett konto</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registrer firmaet ditt. Du får e-post for bekreftelse.
        </p>

        <form action={signUp} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="full_name" className="text-sm font-medium">
              Fullt navn
            </label>
            <input id="full_name" name="full_name" required autoComplete="name" className={inputClass} />
          </div>
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium">
              Telefon
            </label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={inputClass} />
          </div>
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
              minLength={8}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          {sp?.error ? (
            <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {sp.error}
            </p>
          ) : null}
          {sp?.success ? (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Sjekk innboksen din og bekreft e-posten for å fullføre registreringen.
            </p>
          ) : null}
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Opprett konto
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Har du allerede konto?{" "}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Logg inn
          </Link>
        </p>
      </div>
    </main>
  );
}

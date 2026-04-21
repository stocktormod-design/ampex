import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInWithPassword } from "@/app/auth/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: {
    error?: string;
    next?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  let configError: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  } catch (error) {
    configError =
      error instanceof Error ? error.message : "Klarte ikke koble til innlogging.";
  }

  if (configError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
        <Card className="w-full border-destructive/50">
          <CardHeader>
            <CardTitle>Konfigurasjonsfeil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{configError}</p>
            <p>
              Sjekk at <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> og{" "}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> er satt
              i Vercel → Settings → Environment Variables (og redeploy).
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Logg inn i Ampex</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signInWithPassword} className="space-y-4">
            <input type="hidden" name="next" defaultValue={searchParams?.next ?? "/dashboard"} />
            <div className="space-y-2">
              <NativeLabel htmlFor="email">E-post</NativeLabel>
              <NativeInput id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="password">Passord</NativeLabel>
              <NativeInput
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {searchParams?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{searchParams.error}</AlertDescription>
              </Alert>
            ) : null}
            <SubmitButton className="w-full">Logg inn</SubmitButton>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Har du ikke konto?{" "}
            <Link className="underline" href="/auth/register">
              Registrer firma
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

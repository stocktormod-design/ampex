import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signUp } from "@/app/auth/register/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  } catch {
    // Vis skjema — feil handteres ved submit
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Registrer ny konto</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signUp} className="space-y-4">
            <div className="space-y-2">
              <NativeLabel htmlFor="full_name">Fullt navn</NativeLabel>
              <NativeInput id="full_name" name="full_name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="phone">Telefon</NativeLabel>
              <NativeInput id="phone" name="phone" type="tel" autoComplete="tel" />
            </div>
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
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            {searchParams?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{searchParams.error}</AlertDescription>
              </Alert>
            ) : null}
            {searchParams?.success ? (
              <Alert>
                <AlertDescription>
                  Konto opprettet. Sjekk e-post for bekreftelse og fullfør onboarding.
                </AlertDescription>
              </Alert>
            ) : null}
            <SubmitButton className="w-full">Opprett konto</SubmitButton>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Har du allerede konto?{" "}
            <Link className="underline" href="/auth/login">
              Logg inn
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

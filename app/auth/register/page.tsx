import Link from "next/link";
import { signUp } from "@/app/auth/register/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }> | { error?: string; success?: string };
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const sp = searchParams instanceof Promise ? await searchParams : searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Opprett konto</CardTitle>
          <CardDescription>Registrer firmaet ditt. Du får e-post for bekreftelse.</CardDescription>
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
            {sp?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{sp.error}</AlertDescription>
              </Alert>
            ) : null}
            {sp?.success ? (
              <Alert>
                <AlertDescription>
                  Sjekk innboksen din og bekreft e-posten for å fullføre registreringen.
                </AlertDescription>
              </Alert>
            ) : null}
            <SubmitButton className="w-full">Opprett konto</SubmitButton>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Har du allerede konto?{" "}
            <Link href="/auth/login" className="font-medium text-primary hover:underline">
              Logg inn
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

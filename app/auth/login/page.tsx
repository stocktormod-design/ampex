import Link from "next/link";
import { signInWithPassword } from "@/app/auth/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { safeNextPath } from "@/lib/safe-next-path";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: { error?: string; next?: string };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = safeNextPath(searchParams?.next);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Logg inn</CardTitle>
          <CardDescription>Bruk e-post og passord fra administratoren.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInWithPassword} className="space-y-4">
            <input type="hidden" name="next" value={nextPath} />
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
        </CardContent>
      </Card>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

export default function LoginPage({ searchParams }: LoginPageProps) {
  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/dashboard");

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
    }

    redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Logg inn i Ampex</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RegisterPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  async function register(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("full_name") ?? "");
    const phone = String(formData.get("phone") ?? "");

    const supabase = await createClient();
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl,
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (error) {
      redirect(`/auth/register?error=${encodeURIComponent(error.message)}`);
    }

    redirect("/auth/register?success=1");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Registrer ny konto</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={register} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Fullt navn</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passord</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
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
            <Button className="w-full" type="submit">
              Opprett konto
            </Button>
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
